"""Documents attached to other objects, whether hosted externally or internally"""
import enum
from datetime import datetime
from mimetypes import guess_all_extensions

from sqlalchemy import (
    Column,
    UniqueConstraint,
    Integer,
    UnicodeText,
    DateTime,
    String,
    ForeignKey,
    Enum,
    LargeBinary,
    event
)
from sqlalchemy.orm import relationship, backref

from ..lib.antivirus import get_antivirus
from ..lib.sqla_types import CoerceUnicode
from ..lib.sqla import DuplicateHandling
from ..lib.sqla_types import URLString
from ..semantic.virtuoso_mapping import QuadMapPatternS
from ..semantic.namespaces import DCTERMS
from . import DiscussionBoundBase
from .post import Post
from .idea import Idea
from .resource import Resource
from .auth import AgentProfile
from assembl.auth import (
    CrudPermissions, P_READ, P_ADMIN_DISC, P_ADD_POST,
    P_SYSADMIN, P_EDIT_POST, P_ADD_IDEA, P_EDIT_IDEA, P_MANAGE_RESOURCE)


class AttachmentPurpose(enum.Enum):

    DOCUMENT = 'DOCUMENT'  # used for resources center
    EMBED_ATTACHMENT = 'EMBED_ATTACHMENT'
    IMAGE = 'IMAGE'  # used for resources center
    PROFILE_PICTURE = 'PROFILE_PICTURE'
    RESOURCES_CENTER_HEADER_IMAGE = 'RESOURCES_CENTER_HEADER_IMAGE'


class AntiVirusStatus(enum.Enum):
    unchecked = "unchecked"
    passed = "passed"
    failed = "failed"


class Document(DiscussionBoundBase):
    """
    Represents a Document or file, local to the database or (more typically)
    a remote document
    """
    __tablename__ = "document"
    id = Column(
        Integer, primary_key=True)

    type = Column(String(60), nullable=False)
    """
    The cannonical identifier of this document.  If a URL, it's to be
    interpreted as a purl
    """

    __table_args__ = (UniqueConstraint('discussion_id', 'uri_id'), )

    uri_id = Column(URLString)
    creation_date = Column(DateTime, nullable=False, default=datetime.utcnow,
                           info={'rdf': QuadMapPatternS(None,
                                                        DCTERMS.created)})
    discussion_id = Column(Integer, ForeignKey(
        'discussion.id',
        ondelete='CASCADE',
        onupdate='CASCADE',
        ),
        nullable=False, index=True)

    discussion = relationship(
        "Discussion",
        backref=backref(
            'documents',
            cascade="all, delete-orphan"),
    )

    oembed_type = Column(String(1024), server_default="")
    mime_type = Column(String(1024), server_default="")
    # From metadata, not the user
    title = Column(CoerceUnicode(1024), server_default="",
                   info={'rdf': QuadMapPatternS(None, DCTERMS.title)})

    # From metadata, not the user
    description = Column(
        UnicodeText,
        info={'rdf': QuadMapPatternS(None, DCTERMS.description)})

    # From metadata, not the user
    author_name = Column(
        CoerceUnicode())

    # From metadata, not the user
    author_url = Column(URLString)

    # From metadata, not the user
    thumbnail_url = Column(URLString)

    # From metadata, not the user
    site_name = Column(
        CoerceUnicode())

    __mapper_args__ = {
        'polymorphic_identity': 'document',
        'polymorphic_on': 'type',
        'with_polymorphic': '*'
    }

    @property
    def external_url(self):
        return self.uri_id

    def generate_unique_id(self):
        """Method to override in order to create a unique URI of the entity"""
        import uuid
        u = uuid.uuid1()
        return u.urn

    def get_discussion_id(self):
        return self.discussion_id or self.discussion.id

    @classmethod
    def get_discussion_conditions(cls, discussion_id, alias_maker=None):
        return (cls.discussion_id == discussion_id,)

    default_duplicate_handling = DuplicateHandling.USE_ORIGINAL

    def unique_query(self):
        query, _ = super(Document, self).unique_query()
        return query.filter_by(uri_id=self.uri_id), True

    def update_fields(self, new_doc):
        """
        :param dict new_doc: dict object of all of the document types
            with keys:
            set(['url', 'title', 'description', 'oembed', 'mime_type',
                'author_name', 'author_url', 'thumbnail', 'site_name'])
        """
        self.uri_id = new_doc.get('url')
        self.title = new_doc.get('title')
        self.description = new_doc.get('description')
        self.oembed_type = new_doc.get('oembed')
        self.mime_type = new_doc.get('mime_type')
        self.author_name = new_doc.get('author_name')
        self.author_url = new_doc.get('author_url')
        self.thumbnail_url = new_doc.get('thumbnail')
        self.site_name = new_doc.get('site_name')

    # Same crud permissions as a post. Issue with idea edition,
    # but that is usually more restricted than post permission.
    crud_permissions = CrudPermissions(
        P_ADD_POST, P_READ, P_EDIT_POST, P_ADMIN_DISC, P_EDIT_POST, P_ADMIN_DISC)


class File(Document):
    __tablename__ = 'file'
    __mapper_args__ = {
        'polymorphic_identity': 'file'
    }

    def __init__(self, *args, **kwargs):
        if kwargs.get('uri_id', None) is None:
            kwargs['uri_id'] = self.generate_unique_id()
        super(File, self).__init__(*args, **kwargs)

    id = Column(Integer, ForeignKey(
                'document.id', ondelete='CASCADE',
                onupdate='CASCADE'), primary_key=True)

    # Should we defer this?
    data = Column(LargeBinary, nullable=False)
    # Note: use SQLA 1.1 for a better Enum behaviour
    av_checked = Column(Enum(*AntiVirusStatus.__members__.keys(),
                             name="anti_virus_status"),
                        server_default='unchecked')

    def guess_extension(self):
        extensions = guess_all_extensions(self.mime_type)
        if extensions:
            # somewhat random
            return extensions[0]

    def ensure_virus_checked(self, antivirus=None):
        "Check if the file has viruses"
        antivirus = antivirus or get_antivirus()
        # Lock row to avoid multiple antivirus processes
        (status,) = self.db.query(File.av_checked).filter_by(id=self.id).with_for_update().first()
        if status == AntiVirusStatus.failed.unchecked.name:
            safe = antivirus.check(self.data, self.guess_extension())
            status = AntiVirusStatus.passed.name if safe else AntiVirusStatus.failed.name
            self.av_checked = status
        return status

    def safe_data(self):
        if self.av_checked == AntiVirusStatus.unchecked.name:
            needs_check = self.discussion.preferences['requires_virus_check']
            if needs_check:
                self.ensure_virus_checked()
        if self.av_checked == AntiVirusStatus.failed.name:
            return ''
        return self.data

    @Document.external_url.getter
    def external_url(self):
        """
        A public facing URL of the entity that is in question
        """
        if not self.id or not self.discussion:
            return None
        return self.discussion.compose_external_uri('documents', self.id, 'data')


class Attachment(DiscussionBoundBase):
    """
    Represents a Document or file, local to the database or (more typically)
    a remote document
    """
    __tablename__ = "attachment"
    id = Column(
        Integer, primary_key=True)

    type = Column(String(60), nullable=False)
    creation_date = Column(DateTime, nullable=False, default=datetime.utcnow,
                           info={'rdf': QuadMapPatternS(None,
                                                        DCTERMS.created)})
    discussion_id = Column(Integer, ForeignKey(
        'discussion.id',
        ondelete='CASCADE',
        onupdate='CASCADE',
        ),
        nullable=False, index=True)

    discussion = relationship(
        "Discussion",
        backref=backref(
            'attachments',
            cascade="all, delete-orphan"),
    )

    document_id = Column(Integer, ForeignKey(
        'document.id',
        ondelete='CASCADE',
        onupdate='CASCADE',
        ),
        nullable=False,)

    document = relationship(
        Document,
        backref=backref(
            'attachments'),
    )

    creator_id = Column(Integer, ForeignKey('agent_profile.id'),
                        nullable=False)
    creator = relationship(AgentProfile, backref="attachments")
    title = Column(CoerceUnicode(1024), server_default="",
                   info={'rdf': QuadMapPatternS(None, DCTERMS.title)})
    description = Column(
        UnicodeText,
        info={'rdf': QuadMapPatternS(None, DCTERMS.description)})

    attachmentPurpose = Column(
        CoerceUnicode(256), nullable=False, index=True)

    __mapper_args__ = {
        'polymorphic_identity': 'attachment',
        'with_polymorphic': '*',
        'polymorphic_on': 'type'
    }

    def get_discussion_id(self):
        return self.discussion_id or self.discussion.id

    @classmethod
    def get_discussion_conditions(cls, discussion_id, alias_maker=None):
        return (cls.discussion_id == discussion_id,)

    @property
    def external_url(self):
        return self.document.external_url


class DiscussionAttachment(Attachment):
    __mapper_args__ = {
        'polymorphic_identity': 'discussion_attachment',
        'with_polymorphic': '*'
    }

    # Same crud permissions as a post
    crud_permissions = CrudPermissions(P_ADMIN_DISC, P_READ)

    _discussion = relationship("Discussion", backref="discussion_attachments")


class PostAttachment(Attachment):
    __tablename__ = "post_attachment"
    id = Column(Integer, ForeignKey(
        'attachment.id',
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), primary_key=True)

    post_id = Column(Integer, ForeignKey(
        'post.id',
        ondelete='CASCADE',
        onupdate='CASCADE',
        ),
        nullable=False,
        index=True)

    post = relationship(
        Post,
        backref=backref(
            'attachments',
            cascade="all, delete-orphan"),
    )
    __mapper_args__ = {
        'polymorphic_identity': 'post_attachment',
        'with_polymorphic': '*'
    }

    # Same crud permissions as a post
    crud_permissions = CrudPermissions(
        P_ADD_POST, P_READ, P_EDIT_POST, P_ADMIN_DISC, P_EDIT_POST, P_ADMIN_DISC)


@event.listens_for(PostAttachment.post, 'set',
                   propagate=True, active_history=True)
def attachment_object_attached_to_set_listener(target, value,
                                               oldvalue, initiator):

    # print "attachment_object_attached_to_set_listener for target:\
    #      %s set to %s, was %s" % (target, value, oldvalue)

    if oldvalue is not None:
        with oldvalue.db.no_autoflush:
            oldvalue.send_to_changes()
    if value is not None:
        with value.db.no_autoflush:
            value.send_to_changes()


class IdeaAttachment(Attachment):
    __tablename__ = "idea_attachment"
    id = Column(Integer, ForeignKey(
        'attachment.id',
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), primary_key=True)

    idea_id = Column(Integer, ForeignKey(
        'idea.id',
        ondelete='CASCADE',
        onupdate='CASCADE',
        ),
        nullable=False,
        index=True)

    idea = relationship(
        Idea,
        backref=backref(
            'attachments',
            cascade="all, delete-orphan"),
    )
    __mapper_args__ = {
        'polymorphic_identity': 'idea_attachment',
        'with_polymorphic': '*'
    }

    # Same crud permissions as a idea
    crud_permissions = CrudPermissions(
        P_ADD_IDEA, P_READ, P_EDIT_IDEA, P_ADMIN_DISC, P_ADMIN_DISC,
        P_ADMIN_DISC)


class ResourceAttachment(Attachment):

    __tablename__ = "resource_attachment"

    id = Column(Integer, ForeignKey(
        'attachment.id',
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), primary_key=True)

    resource_id = Column(Integer, ForeignKey(
        'resource.id',
        ondelete='CASCADE',
        onupdate='CASCADE',
        ),
        nullable=False,
        index=True)

    resource = relationship(
        Resource,
        backref=backref(
            'attachments',
            cascade="all, delete-orphan"),
    )
    __mapper_args__ = {
        'polymorphic_identity': 'resource_attachment',
        'with_polymorphic': '*'
    }

    # Same crud permissions as a idea
    crud_permissions = CrudPermissions(
        P_MANAGE_RESOURCE, P_READ, P_MANAGE_RESOURCE, P_MANAGE_RESOURCE,
        P_MANAGE_RESOURCE, P_MANAGE_RESOURCE)


class AgentProfileAttachment(Attachment):

    __tablename__ = "agent_profile_attachment"

    id = Column(Integer, ForeignKey(
        'attachment.id',
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), primary_key=True)

    user_id = Column(Integer, ForeignKey(
        'agent_profile.id',
        ondelete='CASCADE',
        onupdate='CASCADE',
        ),
        nullable=False,
        index=True)

    user = relationship(
        AgentProfile,
        backref=backref(
            'profile_attachments',
            cascade="all, delete-orphan"),
    )
    __mapper_args__ = {
        'polymorphic_identity': 'agent_profile_attachment',
        'with_polymorphic': '*'
    }

    crud_permissions = CrudPermissions(
        P_READ, P_SYSADMIN, P_SYSADMIN, P_SYSADMIN, P_READ, P_READ, P_READ)

    def is_owner(self, user_id):
        return user_id == self.user_id
