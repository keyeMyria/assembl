import React from 'react';
import { PropTypes } from 'prop-types';
import { connect } from 'react-redux';
import { compose, graphql } from 'react-apollo';
import { Translate, I18n } from 'react-redux-i18n';
import { getConnectedUserId } from '../../../utils/globalFunctions';
import { getIfPhaseCompletedByIdentifier } from '../../../utils/timeline';
import PostCreator from './postCreator';
import Like from '../../svg/like';
import Disagree from '../../svg/disagree';
import { inviteUserToLogin, displayAlert, displayModal } from '../../../utils/utilityManager';
import addSentimentMutation from '../../../graphql/mutations/addSentiment.graphql';
import deleteSentimentMutation from '../../../graphql/mutations/deleteSentiment.graphql';
import PostQuery from '../../../graphql/PostQuery.graphql';
import { likeTooltip, disagreeTooltip } from '../../common/tooltips';
import { sentimentDefinitionsObject } from '../common/sentimentDefinitions';
import StatisticsDoughnut from '../common/statisticsDoughnut';
import { EXTRA_SMALL_SCREEN_WIDTH } from '../../../constants';
import withLoadingIndicator from '../../common/withLoadingIndicator';
import ResponsiveOverlayTrigger from '../../common/responsiveOverlayTrigger';
import { withScreenWidth } from '../../common/screenDimensions';
import PostBody from '../common/post/postBody';
import hashLinkScroll from '../../../utils/hashLinkScroll';

class Post extends React.Component {
  componentDidMount() {
    // If we have a hash in url and the post id match it, scroll to it.
    const postId = this.props.data.post.id;
    const { hash } = window.location;
    if (hash !== '') {
      const id = hash.replace('#', '').split('?')[0];
      if (id === postId) {
        // Wait an extra 1s to be sure that all previous posts are loaded
        setTimeout(hashLinkScroll, 1000);
      }
    }
  }

  handleSentiment = (event, type) => {
    const { post } = this.props.data;
    const isUserConnected = getConnectedUserId() !== null;
    if (isUserConnected) {
      const { debateData } = this.props.debate;
      const isPhaseCompleted = getIfPhaseCompletedByIdentifier(debateData.timeline, 'survey');
      if (!isPhaseCompleted) {
        const target = event.currentTarget;
        const isMySentiment = post.mySentiment === type;
        if (isMySentiment) {
          this.handleDeleteSentiment(target);
        } else {
          this.handleAddSentiment(target, type);
        }
      } else {
        const body = (
          <div>
            <Translate value="debate.isCompleted" />
          </div>
        );
        displayModal(null, body, true, null, null, true);
      }
    } else {
      inviteUserToLogin();
    }
  };

  handleAddSentiment(target, type) {
    const { id, sentimentCounts, mySentiment } = this.props.data.post;
    this.props
      .addSentiment({
        variables: { postId: id, type: type },
        optimisticResponse: {
          addSentiment: {
            post: {
              id: id,
              sentimentCounts: {
                like: type === 'LIKE' ? sentimentCounts.like + 1 : sentimentCounts.like - (mySentiment === 'LIKE' ? 1 : 0),
                disagree:
                  type === 'DISAGREE'
                    ? sentimentCounts.disagree + 1
                    : sentimentCounts.disagree - (mySentiment === 'DISAGREE' ? 1 : 0),
                dontUnderstand: 0,
                moreInfo: 0,
                __typename: 'SentimentCounts'
              },
              mySentiment: type,
              __typename: 'Post'
            },
            __typename: 'AddSentiment'
          }
        }
      })
      .catch((error) => {
        displayAlert('danger', `${error}`);
      });
  }

  handleDeleteSentiment() {
    const { id, sentimentCounts, mySentiment } = this.props.data.post;
    this.props
      .deleteSentiment({
        variables: { postId: id },
        optimisticResponse: {
          deleteSentiment: {
            post: {
              id: id,
              sentimentCounts: {
                like: sentimentCounts.like - (mySentiment === 'LIKE' ? 1 : 0),
                disagree: sentimentCounts.disagree - (mySentiment === 'DISAGREE' ? 1 : 0),
                dontUnderstand: 0,
                moreInfo: 0,
                __typename: 'SentimentCounts'
              },
              mySentiment: null,
              __typename: 'Post'
            },
            __typename: 'DeleteSentiment'
          }
        }
      })
      .catch((error) => {
        displayAlert('danger', `${error}`);
      });
  }

  render() {
    const { post } = this.props.data;
    const { contentLocale, lang, screenWidth, originalLocale } = this.props;
    const { debateData } = this.props.debate;
    const { bodyEntries } = post;
    const translate = contentLocale !== originalLocale;

    let body;
    if (bodyEntries.length > 1) {
      // first entry is the translated version, example localeCode "fr-x-mtfrom-en"
      // second entry is the original, example localeCode "en"
      body = translate ? bodyEntries[0].value : bodyEntries[1].value;
    } else {
      // translation is not enabled or the message is already in the desired locale
      body = bodyEntries[0].value;
    }
    const likeComponent = (
      <div
        className={post.mySentiment === 'LIKE' ? 'sentiment sentiment-active' : 'sentiment'}
        onClick={(event) => {
          this.handleSentiment(event, 'LIKE');
        }}
      >
        <Like size={25} />
      </div>
    );
    const disagreeComponent = (
      <div
        className={post.mySentiment === 'DISAGREE' ? 'sentiment sentiment-active' : 'sentiment'}
        onClick={(event) => {
          this.handleSentiment(event, 'DISAGREE');
        }}
      >
        <Disagree size={25} />
      </div>
    );

    const { displayName, isDeleted } = post.creator;

    return (
      <div className="shown box" id={post.id}>
        <div className="content">
          <PostCreator name={isDeleted ? I18n.t('deletedUser') : displayName} />
          <PostBody
            translationEnabled={debateData.translationEnabled}
            contentLocale={contentLocale}
            id={post.id}
            lang={lang}
            translate={translate}
            originalLocale={originalLocale}
            body={body}
            bodyMimeType={post.bodyMimeType}
          />
          <div className="sentiments">
            <div className="sentiment-label">
              <Translate value="debate.survey.react" />
            </div>
            <ResponsiveOverlayTrigger placement="top" tooltip={likeTooltip} component={likeComponent} />
            <ResponsiveOverlayTrigger placement="top" tooltip={disagreeTooltip} component={disagreeComponent} />
          </div>
        </div>
        <div className="statistic">
          {screenWidth < EXTRA_SMALL_SCREEN_WIDTH && (
            <div className="sentiments">
              <ResponsiveOverlayTrigger placement="top" tooltip={likeTooltip} component={likeComponent} />
              <ResponsiveOverlayTrigger placement="top" tooltip={disagreeTooltip} component={disagreeComponent} />
            </div>
          )}
          <StatisticsDoughnut
            elements={[
              { color: sentimentDefinitionsObject.like.color, count: post.sentimentCounts.like },
              { color: sentimentDefinitionsObject.disagree.color, count: post.sentimentCounts.disagree }
            ]}
          />
          <div className="stat-sentiment">
            <div>
              <div className="min-sentiment">
                <Like size={15} />&nbsp;<span className="txt">{post.sentimentCounts.like}</span>
              </div>
            </div>
            <div>
              <div className="min-sentiment">
                <Disagree size={15} />&nbsp;<span className="txt">{post.sentimentCounts.disagree}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="clear">&nbsp;</div>
      </div>
    );
  }
}

Post.propTypes = {
  addSentiment: PropTypes.func.isRequired,
  deleteSentiment: PropTypes.func.isRequired
};

const mapStateToProps = (state, { id }) => ({
  debate: state.debate,
  contentLocale: state.contentLocale.getIn([id, 'contentLocale']),
  lang: state.i18n.locale
});

export default compose(
  connect(mapStateToProps),
  graphql(PostQuery),
  graphql(addSentimentMutation, {
    name: 'addSentiment'
  }),
  graphql(deleteSentimentMutation, {
    name: 'deleteSentiment'
  }),
  withLoadingIndicator(),
  withScreenWidth
)(Post);