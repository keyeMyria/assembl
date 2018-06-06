import os.path

import graphene
from graphene_sqlalchemy import SQLAlchemyObjectType
from pyramid.httpexceptions import HTTPUnauthorized
from pyramid.security import Everyone

from assembl import models
from assembl.auth import IF_OWNED, CrudPermissions
from assembl.auth.util import get_permissions

from .document import Document
from .types import SecureObjectType
from .langstring import (
    LangStringEntry, LangStringEntryInput, resolve_langstring,
    resolve_langstring_entries, update_langstring_from_input_entries)
from .utils import abort_transaction_on_exception


class Discussion(SecureObjectType, SQLAlchemyObjectType):
    class Meta:
        model = models.Discussion
        only_fields = ('id',)

    homepage_url = graphene.String()
    title = graphene.String(lang=graphene.String())
    title_entries = graphene.List(LangStringEntry)
    subtitle = graphene.String(lang=graphene.String())
    subtitle_entries = graphene.List(LangStringEntry)

    def resolve_homepage_url(self, args, context, info):
        # TODO: Remove this resolver and add URLString to
        # the Graphene SQLA converters list
        return self.homepage_url

    def resolve_title(self, args, context, info):
        """Title value in given locale."""
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        return resolve_langstring(discussion.title, args.get('lang'))

    def resolve_title_entries(self, args, context, info):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        if discussion.title:
            return resolve_langstring_entries(discussion, 'title')

        return []

    def resolve_subtitle(self, args, context, info):
        """Subtitle value in given locale."""
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        return resolve_langstring(discussion.subtitle, args.get('lang'))

    def resolve_subtitle_entries(self, args, context, info):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        if discussion.subtitle:
            return resolve_langstring_entries(discussion, 'subtitle')

        return []


class UpdateDiscussion(graphene.Mutation):
    class Input:
        title_entries = graphene.List(LangStringEntryInput)
        subtitle_entries = graphene.List(LangStringEntryInput)

    discussion = graphene.Field(lambda: Discussion)

    @staticmethod
    @abort_transaction_on_exception
    def mutate(root, args, context, info):
        cls = models.Discussion
        discussion_id = context.matchdict['discussion_id']
        discussion = cls.get(discussion_id)
        user_id = context.authenticated_userid or Everyone

        permissions = get_permissions(user_id, discussion_id)
        allowed = discussion.user_can(
            user_id, CrudPermissions.UPDATE, permissions)
        if not allowed:
            raise HTTPUnauthorized()

        with cls.default_db.no_autoflush as db:
            title_entries = args.get('title_entries')
            if title_entries is not None and len(title_entries) == 0:
                raise Exception(
                    'Title entries needs at least one entry')
                # Better to have this message than
                # 'NoneType' object has no attribute 'owner_object'
                # when creating the saobj below if title=None

            update_langstring_from_input_entries(
                discussion, 'title', title_entries)

            subtitle_entries = args.get('subtitle_entries')
            update_langstring_from_input_entries(
                discussion, 'subtitle', subtitle_entries)

        db.flush()
        discussion = cls.get(discussion_id)
        return UpdateDiscussion(discussion=discussion)


class LocalePreference(graphene.ObjectType):
    locale = graphene.String()
    name = graphene.String(in_locale=graphene.String(required=True))
    native_name = graphene.String()

    def resolve_name(self, args, context, info):
        in_locale = args.get('in_locale') or None
        locale_model = models.Locale.get_or_create(in_locale)

        name = models.LocaleLabel.names_of_locales_in_locale([self.locale],
                                                             locale_model)
        if not name:
            # If the locale label does not exist, fallback on English
            locale_model = models.Locale.get_or_create('en')
            name = models.LocaleLabel.names_of_locales_in_locale([self.locale],
                                                                 locale_model)

        return name[self.locale]

    def resolve_native_name(self, args, context, info):
        locale = self.locale
        if locale == 'zh_Hans':  # we have the native name only for zh
            locale = 'zh'

        locale_model = models.Locale.get_or_create(locale)
        name = models.LocaleLabel.names_of_locales_in_locale([locale],
                                                             locale_model)
        if not name:
            # If the locale label does not exist, fallback on English
            locale_model = models.Locale.get_or_create('en')
            name = models.LocaleLabel.names_of_locales_in_locale([locale],
                                                                 locale_model)

        return name[locale]


class DiscussionPreferences(graphene.ObjectType):
    languages = graphene.List(LocalePreference)


class ResourcesCenter(graphene.ObjectType):

    title = graphene.String(lang=graphene.String())
    title_entries = graphene.List(LangStringEntry)
    header_image = graphene.Field(Document)

    def resolve_title(self, args, context, info):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        return resolve_langstring(
            discussion.resources_center_title, args.get('lang'))

    def resolve_title_entries(self, args, context, info):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        return resolve_langstring_entries(discussion, 'resources_center_title')

    def resolve_header_image(self, args, context, info):
        RESOURCES_CENTER_HEADER_IMAGE = models.AttachmentPurpose.RESOURCES_CENTER_HEADER_IMAGE.value
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        for attachment in discussion.attachments:
            if attachment.attachmentPurpose == RESOURCES_CENTER_HEADER_IMAGE:
                return attachment.document


class LegalContents(graphene.ObjectType):

    legal_notice = graphene.String(lang=graphene.String())
    terms_and_conditions = graphene.String(lang=graphene.String())
    legal_notice_entries = graphene.List(LangStringEntry)
    terms_and_conditions_entries = graphene.List(LangStringEntry)
    cookies_policy = graphene.String(lang=graphene.String())
    privacy_policy = graphene.String(lang=graphene.String())
    cookies_policy_entries = graphene.List(LangStringEntry)
    privacy_policy_entries = graphene.List(LangStringEntry)

    def resolve_legal_notice(self, args, context, info):
        """Legal notice value in given locale."""
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        return resolve_langstring(discussion.legal_notice, args.get('lang'))

    def resolve_terms_and_conditions(self, args, context, info):
        """Terms and conditions value in given locale."""
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        return resolve_langstring(discussion.terms_and_conditions, args.get('lang'))

    def resolve_legal_notice_entries(self, args, context, info):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        if discussion.legal_notice:
            return resolve_langstring_entries(discussion, 'legal_notice')

        return []

    def resolve_terms_and_conditions_entries(self, args, context, info):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        if discussion.terms_and_conditions:
            return resolve_langstring_entries(discussion, 'terms_and_conditions')

        return []

    def resolve_cookies_policy(self, args, context, info):
        """Cookies policy value in given locale."""
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        return resolve_langstring(discussion.cookies_policy, args.get('lang'))

    def resolve_privacy_policy_conditions(self, args, context, info):
        """Privacy policy value in given locale."""
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        return resolve_langstring(discussion.privacy_policy, args.get('lang'))

    def resolve_cookies_policy_entries(self, args, context, info):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        if discussion.cookies_policy:
            return resolve_langstring_entries(discussion, 'cookies_policy')

        return []

    def resolve_privacy_policy_entries(self, args, context, info):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        if discussion.privacy_policy:
            return resolve_langstring_entries(discussion, 'privacy_policy')

        return []


class UpdateResourcesCenter(graphene.Mutation):
    class Input:
        title_entries = graphene.List(LangStringEntryInput)
        header_image = graphene.String()

    resources_center = graphene.Field(lambda: ResourcesCenter)

    @staticmethod
    @abort_transaction_on_exception
    def mutate(root, args, context, info):
        RESOURCES_CENTER_HEADER_IMAGE = models.AttachmentPurpose.RESOURCES_CENTER_HEADER_IMAGE.value
        cls = models.Discussion
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        user_id = context.authenticated_userid or Everyone

        permissions = get_permissions(user_id, discussion_id)
        allowed = discussion.user_can(
            user_id, CrudPermissions.UPDATE, permissions)
        if not allowed:
            raise HTTPUnauthorized()

        with cls.default_db.no_autoflush:
            db = discussion.db
            title_entries = args.get('title_entries')
            if title_entries is not None and len(title_entries) == 0:
                raise Exception(
                    'Resources center title entries needs at least one entry')
                # Better to have this message than
                # 'NoneType' object has no attribute 'owner_object'
                # when creating the saobj below if title=None

            update_langstring_from_input_entries(
                discussion, 'resources_center_title', title_entries)

            # add uploaded image as an attachment to the discussion
            image = args.get('header_image')
            if image is not None:
                filename = os.path.basename(context.POST[image].filename)
                mime_type = context.POST[image].type
                document = models.File(
                    discussion=discussion,
                    mime_type=mime_type,
                    title=filename)
                document.add_file_data(context.POST[image].file)

                # if there is already an IMAGE, remove it with the
                # associated document
                header_images = [
                    att for att in discussion.attachments
                    if att.attachmentPurpose == RESOURCES_CENTER_HEADER_IMAGE
                ]
                if header_images:
                    header_image = header_images[0]
                    header_image.document.delete_file()
                    db.delete(header_image.document)
                    discussion.attachments.remove(header_image)

                db.add(models.DiscussionAttachment(
                    document=document,
                    discussion=discussion,
                    creator_id=context.authenticated_userid,
                    title=filename,
                    attachmentPurpose=RESOURCES_CENTER_HEADER_IMAGE
                ))

        db.flush()
        resources_center = ResourcesCenter()
        return UpdateResourcesCenter(resources_center=resources_center)


class UpdateDiscussionPreferences(graphene.Mutation):
    class Input:
        languages = graphene.List(graphene.String, required=True)

    preferences = graphene.Field(lambda: DiscussionPreferences)

    @staticmethod
    @abort_transaction_on_exception
    def mutate(root, args, context, info):
        cls = models.Preferences
        discussion_id = context.matchdict['discussion_id']

        user_id = context.authenticated_userid or Everyone
        discussion = models.Discussion.get(discussion_id)

        permissions = get_permissions(user_id, discussion_id)
        allowed = cls.user_can_cls(
            user_id, CrudPermissions.UPDATE, permissions)
        if not allowed or (allowed == IF_OWNED and user_id == Everyone):
            raise HTTPUnauthorized()
        prefs_to_save = args.get('languages')
        if not prefs_to_save:
            raise Exception("Must pass at least one preference to be saved")

        discussion.discussion_locales = prefs_to_save
        discussion.db.flush()

        discussion_pref = DiscussionPreferences(
            languages=[LocalePreference(locale=x) for
                       x in discussion.discussion_locales])
        return UpdateDiscussionPreferences(preferences=discussion_pref)


class UpdateLegalContents(graphene.Mutation):
    class Input:
        legal_notice_entries = graphene.List(LangStringEntryInput)
        terms_and_conditions_entries = graphene.List(LangStringEntryInput)
        cookies_policy_entries = graphene.List(LangStringEntryInput)
        privacy_policy_entries = graphene.List(LangStringEntryInput)

    legal_contents = graphene.Field(lambda: LegalContents)

    @staticmethod
    @abort_transaction_on_exception
    def mutate(root, args, context, info):
        cls = models.Discussion
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        user_id = context.authenticated_userid or Everyone

        permissions = get_permissions(user_id, discussion_id)
        allowed = discussion.user_can(
            user_id, CrudPermissions.UPDATE, permissions)
        if not allowed:
            raise HTTPUnauthorized()

        with cls.default_db.no_autoflush as db:
            legal_notice_entries = args.get('legal_notice_entries')
            if legal_notice_entries is not None and len(legal_notice_entries) == 0:
                raise Exception(
                    'Legal notice entries needs at least one entry')
                # Better to have this message than
                # 'NoneType' object has no attribute 'owner_object'
                # when creating the saobj below if title=None

            update_langstring_from_input_entries(
                discussion, 'legal_notice', legal_notice_entries)

            terms_and_conditions_entries = args.get(
                'terms_and_conditions_entries')
            if terms_and_conditions_entries is not None and len(terms_and_conditions_entries) == 0:
                raise Exception(
                    'Terms and conditions entries needs at least one entry')
                # Better to have this message than
                # 'NoneType' object has no attribute 'owner_object'
                # when creating the saobj below if title=None

            update_langstring_from_input_entries(
                discussion, 'terms_and_conditions', terms_and_conditions_entries)

            cookies_policy_entries = args.get('cookies_policy_entries')
            if cookies_policy_entries is not None and len(cookies_policy_entries) == 0:
                raise Exception(
                    'Cookies policy entries needs at least one entry')

            update_langstring_from_input_entries(
                discussion, 'cookies_policy', cookies_policy_entries)

            privacy_policy_entries = args.get('privacy_policy_entries')
            if privacy_policy_entries is not None and len(privacy_policy_entries) == 0:
                raise Exception(
                    'Privacy policy entries need to be at least one entry'
                )

            update_langstring_from_input_entries(
                discussion, 'privacy_policy', privacy_policy_entries)

        db.flush()
        legal_contents = LegalContents()
        return UpdateLegalContents(legal_contents=legal_contents)


class VisitsAnalytics(graphene.ObjectType):

    sum_visits_length = graphene.Int()
    nb_pageviews = graphene.Int()
    nb_uniq_pageviews = graphene.Int()

    @classmethod
    def query_analytics(cls, args, context, info, single_metric=None):
        discussion_id = context.matchdict['discussion_id']
        discussion = models.Discussion.get(discussion_id)
        start = args.get('start_date') or None
        end = args.get('end_date') or None
        try:
            if single_metric is not None:
                data = discussion.get_visits_time_series_analytics(start, end, [single_metric])
                return data[single_metric]
            else:
                return discussion.get_visits_time_series_analytics(start, end)
        except ValueError:
            return None
        except Exception:
            context.logger().exception('Error with Matomo request')
            return None

    def generic_resolver(self, args, context, info, field_name):
        val = getattr(self, field_name, None)
        if val is not None:
            return val
        return VisitsAnalytics.query_analytics(args, context, info, field_name)

    @classmethod
    def build_from_full_query(cls, args, context, info):
        data = VisitsAnalytics.query_analytics(args, context, info)
        if not data:
            return VisitsAnalytics(sum_visits_length=None, nb_pageviews=None, nb_uniq_pageviews=None)
        sum_visits_length = data.get('sum_visits_length', None)
        nb_pageviews = data.get('nb_pageviews', None)
        nb_uniq_pageviews = data.get('nb_uniq_pageviews', None)
        return VisitsAnalytics(sum_visits_length=sum_visits_length, nb_pageviews=nb_pageviews, nb_uniq_pageviews=nb_uniq_pageviews)

    def resolve_sum_visits_length(self, args, context, info):
        return self.generic_resolver(args, context, info, "sum_visits_length")

    def resolve_nb_pageviews(self, args, context, info):
        return self.generic_resolver(args, context, info, "nb_pageviews")

    def resolve_nb_uniq_pageviews(self, args, context, info):
        return self.generic_resolver(args, context, info, "nb_uniq_pageviews")
