from datetime import datetime
import logging

from sqlalchemy import (
    Column,
    Integer,
    SmallInteger,
    Boolean,
    UnicodeText,
    String,
    Unicode,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship, backref
from virtuoso.alchemy import CoerceUnicode
from virtuoso.vmapping import PatternIriClass
# from virtuoso.textindex import TextIndex, TableWithTextIndex
from bs4 import BeautifulSoup

from ..lib.sqla import (INSERT_OP, UPDATE_OP, get_model_watcher, Base)
from ..lib.utils import get_global_base_url
from . import DiscussionBoundBase
from ..semantic.virtuoso_mapping import QuadMapPatternS
from ..auth import (
    CrudPermissions, P_ADD_POST, P_READ, P_ADMIN_DISC, P_EDIT_POST)
from ..semantic.namespaces import (
    SIOC, CATALYST, ASSEMBL, DCTERMS, QUADNAMES, FOAF)
from .discussion import Discussion


log = logging.getLogger('assembl')


class ContentSource(DiscussionBoundBase):
    """
    A ContentSource is where any outside content comes from. .
    """
    __tablename__ = "content_source"
    rdf_class = SIOC.Container

    id = Column(Integer, primary_key=True,
                info={'rdf': QuadMapPatternS(None, ASSEMBL.db_id)})
    name = Column(UnicodeText, nullable=False)
    type = Column(String(60), nullable=False)

    creation_date = Column(DateTime, nullable=False, default=datetime.utcnow,
        info={'rdf': QuadMapPatternS(None, DCTERMS.created)})

    discussion_id = Column(Integer, ForeignKey(
        'discussion.id',
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), nullable=False)
    connection_error = Column(SmallInteger)
    error_description = Column(String)
    error_backoff_until = Column(DateTime)

    # Non-persistant, default reading status
    read_status = 0

    @classmethod
    def special_quad_patterns(cls, alias_maker, discussion_id):
        return [
            QuadMapPatternS(
                Discussion.iri_class().apply(cls.discussion_id),
                CATALYST.uses_source,
                cls.iri_class().apply(cls.id),
                name=QUADNAMES.uses_source,
                conditions=(cls.discussion_id != None,)),
        ]

    discussion = relationship(
        "Discussion",
        backref=backref(
            'sources', order_by=creation_date,
            cascade="all, delete-orphan"),
        info={'rdf': QuadMapPatternS(None, ASSEMBL.in_conversation)})

    __mapper_args__ = {
        'polymorphic_identity': 'content_source',
        'polymorphic_on': type,
        'with_polymorphic': '*'
    }

    retypeable_as = ("IMAPMailbox", "MailingList", "AbstractMailbox",
                     "AbstractFilesystemMailbox", "AnnotatorSource",
                     "PostSource", "FeedPostSource", "LoomioPostSource",
                     "FacebookGenericSource", "FacebookGroupSource",
                     "FacebookPagePostsSource", "FacebookPageFeedSource",
                     "FacebookSinglePostSource", "EdgeSenseDrupalSource")

    def import_content(self, only_new=True):
        from assembl.tasks.source_reader import wake
        wake(self.id, reimport=not only_new)

    def make_reader(self):
        return None

    def get_discussion_id(self):
        return self.discussion_id or self.discussion.id

    @property
    def connection_error_as_text(self):
        from ..tasks.source_reader import ReaderStatus
        return (ReaderStatus(self.connection_error).name
                if self.connection_error is not None else None)

    @classmethod
    def get_discussion_conditions(cls, discussion_id, alias_maker=None):
        return (cls.discussion_id == discussion_id,)

    # Cannot be readable to all, because subclasses contain passwords
    crud_permissions = CrudPermissions(P_ADMIN_DISC, P_ADMIN_DISC)


class PostSource(ContentSource):
    """
    A Discussion PostSource is where commentary that is handled in the form of
    Assembl posts comes from.

    A discussion source should have a method for importing all content, as well
    as only importing new content. Maybe the standard interface for this should
    be `source.import()`.
    """
    __tablename__ = "post_source"
    rdf_class = ASSEMBL.PostSource

    id = Column(Integer, ForeignKey(
        'content_source.id',
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), primary_key=True)

    last_import = Column(DateTime)

    __mapper_args__ = {
        'polymorphic_identity': 'post_source',
    }

    def get_discussion_id(self):
        return self.discussion_id or self.discussion.id

    def get_default_prepended_id(self):
        # Used for PostSource's whose incoming posts cannot guarantee
        # Post.post_source_id is unique; in which case, the Post.message_id
        # which is a globally unique value maintain uniqueness integrity
        # by calling this function
        # Must be implemented by subclasses that will not have unique
        # id's on their incoming posts
        return ""

    @property
    def number_of_imported_posts(self):
        from .post import ImportedPost
        return self.db.query(ImportedPost).filter_by(source_id=self.id).count()

    @classmethod
    def get_discussion_conditions(cls, discussion_id, alias_maker=None):
        return (cls.discussion_id == discussion_id,)

    def send_post(self, post):
        """ Send a new post in the discussion to the source. """
        log.warn(
            "Source %s did not implement PostSource::send_post()"
            % self.__class__.__name__)


class AnnotatorSource(ContentSource):
    """
    A source of content coming from annotator
    """
    __tablename__ = "annotator_source"

    id = Column(Integer, ForeignKey(
        'content_source.id',
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), primary_key=True)

    __mapper_args__ = {
        'polymorphic_identity': 'annotator_source',
    }


class ContentSourceIDs(Base):
    """
    A table that keeps track of the number of external identities that
    an Assembl post can be exported to.

    A stepping-stone to having Sinks
    """
    __tablename__ = 'content_source_ids'

    id = Column(Integer, primary_key=True)
    source_id = Column(
        Integer, ForeignKey(
            'content_source.id', onupdate='CASCADE', ondelete='CASCADE'),
        nullable=False)
    source = relationship('ContentSource', backref=backref(
                          'pushed_messages',
                          cascade='all, delete-orphan'))

    post_id = Column(
        Integer, ForeignKey(
            'content.id', onupdate='CASCADE', ondelete='CASCADE'),
        nullable=False)
    post = relationship('Content',
                        backref=backref('post_sink_associations',
                                        cascade='all, delete-orphan'))
    message_id_in_source = Column(String(256), nullable=False)


class Content(DiscussionBoundBase):
    """
    Content is a polymorphic class to describe what is imported from a Source.
    The body and subject properly belong to the Post but were moved here to
    optimize the most common case.
    """
    __tablename__ = "content"
    # __table_cls__ = TableWithTextIndex

    rdf_class = SIOC.Post

    id = Column(Integer, primary_key=True,
                info={'rdf': QuadMapPatternS(None, ASSEMBL.db_id)})
    type = Column(String(60), nullable=False)
    creation_date = Column(DateTime, nullable=False, default=datetime.utcnow,
        info={'rdf': QuadMapPatternS(None, DCTERMS.created)})

    discussion_id = Column(Integer, ForeignKey(
        'discussion.id',
        ondelete='CASCADE',
        onupdate='CASCADE',
    ),
        nullable=False,)

    discussion = relationship(
        "Discussion",
        backref=backref(
            'posts', order_by=creation_date,
            cascade="all, delete-orphan"),
        info={'rdf': QuadMapPatternS(None, ASSEMBL.in_conversation)}
    )

    subject = Column(CoerceUnicode(), server_default="",
        info={'rdf': QuadMapPatternS(None, DCTERMS.title)})
    # TODO: check HTML or text? SIOC.content should be text.
    # Do not give it for now, privacy reasons
    body = Column(UnicodeText, server_default="")
    #    info={'rdf': QuadMapPatternS(None, SIOC.content)})

    hidden = Column(Boolean, server_default='0')

    # Another bloody virtuoso bug. Insert with large string fails.
    # body_text_index = TextIndex(body, clusters=[discussion_id])

    __mapper_args__ = {
        'polymorphic_identity': 'content',
        'polymorphic_on': 'type',
        'with_polymorphic': '*'
    }

    def get_body(self):
        if self.body:
            return self.body.strip()
        return self.body

    def get_title(self):
        return self.subject

    def get_body_mime_type(self):
        """ Return the format of the body, so the frontend will know how to
        display it.  Currently, only:
        text/plain (Understood as preformatted text)
        text/html (Undestood as some subset of html)
        """
        return "text/plain"

    def get_body_as_html(self):
        if self.get_body_mime_type() == 'text/html':
            return self.body
        else:
            return '<span style="white-space: pre-wrap">%s</div>' % (
                self.get_body_as_text(),)

    def get_body_as_text(self):
        mimetype = self.get_body_mime_type()
        body = self.body or ""
        if mimetype == 'text/plain':
            return body.strip()
        elif mimetype == 'text/html':
            return BeautifulSoup(body).get_text().strip()
        else:
            log.error("What is this mimetype?" + mimetype)
            return body

    def send_to_changes(self, connection=None, operation=UPDATE_OP,
                        discussion_id=None, view_def="changes"):
        super(Content, self).send_to_changes(
            connection, operation, discussion_id, view_def)
        watcher = get_model_watcher()
        if operation == INSERT_OP:
            watcher.processPostCreated(self.id)

    def get_discussion_id(self):
        return self.discussion_id or self.discussion.id

    @property
    def exported_to_sources(self):
        return [ContentSource.uri_generic(s.source_id)
                for s in self.post_sink_associations]

    @classmethod
    def get_discussion_conditions(cls, discussion_id, alias_maker=None):
        return (cls.discussion_id == discussion_id,)

    @classmethod
    def special_quad_patterns(cls, alias_maker, discussion_id):
        discussion_alias = alias_maker.get_reln_alias(cls.discussion)
        return [
            QuadMapPatternS(
                None, FOAF.homepage,
                PatternIriClass(
                    QUADNAMES.post_external_link_iri,
                    # TODO: Use discussion.get_base_url.
                    # This should be computed outside the DB.
                    get_global_base_url() + '/%s/posts/local:Content/%d', None,
                    ('slug', Unicode, False), ('id', Integer, False)).apply(
                    discussion_alias.slug, cls.id),
                name=QUADNAMES.post_external_link_map)
        ]

    widget_idea_links = relationship('IdeaContentWidgetLink')

    def widget_ideas(self):
        from .idea import Idea
        return [Idea.uri_generic(wil.idea_id) for wil in self.widget_idea_links]

    crud_permissions = CrudPermissions(
            P_ADD_POST, P_READ, P_EDIT_POST, P_ADMIN_DISC,
            P_EDIT_POST, P_ADMIN_DISC)
