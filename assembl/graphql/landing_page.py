# -*- coding=utf-8 -*-
import graphene
from graphene.relay import Node
from graphene_sqlalchemy import SQLAlchemyObjectType

from assembl import models
from assembl.auth import CrudPermissions

from .langstring import LangStringEntry, resolve_langstring, resolve_langstring_entries
from .permissions_helpers import require_cls_permission, require_instance_permission
from .types import SecureObjectType
from .utils import abort_transaction_on_exception


class LandingPageModuleType(SecureObjectType, SQLAlchemyObjectType):

    class Meta:
        model = models.LandingPageModuleType
        interfaces = (Node, )
        only_fields = ('id', 'default_order', 'editable_order', 'identifier', 'required')

    title = graphene.String(lang=graphene.String())
    title_entries = graphene.List(LangStringEntry)

    def resolve_title(self, args, context, info):
        return resolve_langstring(self.title, args.get('lang'))

    def resolve_title_entries(self, args, context, info):
        return resolve_langstring_entries(self, 'title')


class LandingPageModule(SecureObjectType, SQLAlchemyObjectType):

    class Meta:
        model = models.LandingPageModule
        interfaces = (Node, )
        only_fields = ('id', 'enabled', 'order', 'configuration')

    module_type = graphene.Field(LandingPageModuleType)
    exists_in_database = graphene.Boolean()

    def resolve_exists_in_database(self, args, context, info):
        return self.id > 0

    def resolve_id(self, args, context, info):
        if self.id < 0:
            # this is a temporary object we created manually in resolve_landing_page_modules
            return self.id
        else:
            # this is a SQLAlchemy object
            # we can't use super here, so we just copy/paste resolve_id method from SQLAlchemyObjectType class
            from graphene.relay import is_node
            graphene_type = info.parent_type.graphene_type
            if is_node(graphene_type):
                return self.__mapper__.primary_key_from_instance(self)[0]
            return getattr(self, graphene_type._meta.id, None)


class CreateLandingPageModule(graphene.Mutation):

    class Input:
        type_identifier = graphene.String()
        enabled = graphene.Boolean()
        order = graphene.Float()
        configuration = graphene.String()

    landing_page_module = graphene.Field(lambda: LandingPageModule)

    @staticmethod
    @abort_transaction_on_exception
    def mutate(root, args, context, info):
        cls = models.LandingPageModule
        discussion_id = context.matchdict['discussion_id']
        require_cls_permission(CrudPermissions.CREATE, cls, context)
        configuration = args.get('configuration')
        order = args.get('order')
        enabled = args.get('enabled')
        module_type_identifier = args.get('type_identifier')
        with cls.default_db.no_autoflush as db:
            module_type = db.query(models.LandingPageModuleType).filter(
                models.LandingPageModuleType.identifier == module_type_identifier).one()
            saobj = cls(
                discussion_id=discussion_id,
                configuration=configuration,
                order=order,
                enabled=enabled,
                module_type=module_type
            )
            db.add(saobj)
            db.flush()

        return CreateLandingPageModule(landing_page_module=saobj)


class UpdateLandingPageModule(graphene.Mutation):

    class Input:
        id = graphene.ID(required=True)
        enabled = graphene.Boolean()
        order = graphene.Float()
        configuration = graphene.String()

    landing_page_module = graphene.Field(lambda: LandingPageModule)

    @staticmethod
    @abort_transaction_on_exception
    def mutate(root, args, context, info):
        cls = models.LandingPageModule
        configuration = args.get('configuration')
        order = args.get('order')
        enabled = args.get('enabled')
        module_id = args.get('id')
        module_id = int(Node.from_global_id(module_id)[1])
        require_instance_permission(CrudPermissions.UPDATE, cls.get(module_id), context)
        with cls.default_db.no_autoflush as db:
            module = db.query(models.LandingPageModule).filter(
                models.LandingPageModule.id == module_id).one()
            module.enabled = enabled
            module.order = order
            module.configuration = configuration
            db.flush()

        return UpdateLandingPageModule(landing_page_module=module)
