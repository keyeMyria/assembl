// @flow
import get from 'lodash/get';
import * as React from 'react';
import { ApolloClient, withApollo } from 'react-apollo';
import { Translate } from 'react-redux-i18n';
import { OverlayTrigger } from 'react-bootstrap';
import { MEDIUM_SCREEN_WIDTH } from '../../../constants';
import { sharePostTooltip } from '../../common/tooltips';

import getOverflowMenuForPost from './overflowMenu';
import ResponsiveOverlayTrigger from '../../common/responsiveOverlayTrigger';
import { getConnectedUserId } from '../../../utils/globalFunctions';
import { openShareModal, displayModal } from '../../../utils/utilityManager';
import Permissions, { connectedUserCan } from '../../../utils/permissions';
import Sentiments from './sentiments';
import getSentimentStats from './sentimentStats';
import sentimentDefinitions from './sentimentDefinitions';
import { getIfPhaseCompletedByIdentifier } from '../../../utils/timeline';
import { withScreenWidth } from '../../common/screenDimensions';

type Props = {
  client: ApolloClient,
  creatorUserId: string,
  debateData: DebateData,
  editable: boolean,
  handleEditClick: Function,
  identifier: string,
  mySentiment: string,
  numChildren: number,
  postId: string,
  routerParams: RouterParams,
  screenWidth: number,
  sentimentCounts: SentimentCountsFragment
};

class PostActions extends React.Component<Props> {
  static defaultProps = {
    editable: true,
    numChildren: 0
  };

  displayPhaseCompletedModal = (): void => {
    const body = (
      <div>
        <Translate value="debate.noAnswer" />
      </div>
    );
    displayModal(null, body, true, null, null, true);
  };

  render() {
    const {
      client,
      creatorUserId,
      debateData,
      editable,
      handleEditClick,
      identifier,
      mySentiment,
      numChildren,
      postId,
      routerParams,
      screenWidth,
      sentimentCounts
    } = this.props;
    let count = 0;
    const totalSentimentsCount = sentimentCounts
      ? sentimentCounts.like + sentimentCounts.disagree + sentimentCounts.dontUnderstand + sentimentCounts.moreInfo
      : 0;
    const connectedUserId = getConnectedUserId();
    const userCanDeleteThisMessage =
      (connectedUserId === String(creatorUserId) && connectedUserCan(Permissions.DELETE_MY_POST)) ||
      connectedUserCan(Permissions.DELETE_POST);
    const userCanEditThisMessage = connectedUserId === String(creatorUserId) && connectedUserCan(Permissions.EDIT_MY_POST);
    const modalTitle = <Translate value="debate.sharePost" />;
    if (!debateData) return null;
    const useSocial = debateData.useSocialMedia;
    let overflowMenu = null;
    const tooltipPlacement = screenWidth >= MEDIUM_SCREEN_WIDTH ? 'left' : 'top';
    const isPhaseCompleted = getIfPhaseCompletedByIdentifier(debateData.timeline, identifier);
    if (editable && (userCanDeleteThisMessage || userCanEditThisMessage)) {
      overflowMenu = (
        <div className="overflow-action">
          <OverlayTrigger
            trigger="click"
            rootClose
            placement={tooltipPlacement}
            overlay={getOverflowMenuForPost(postId, userCanDeleteThisMessage, userCanEditThisMessage, client, handleEditClick)}
          >
            <div>
              {screenWidth >= MEDIUM_SCREEN_WIDTH ? (
                <span className="assembl-icon-ellipsis-vert" />
              ) : (
                <span className="assembl-icon-ellipsis" />
              )}
            </div>
          </OverlayTrigger>
        </div>
      );
    }
    const shareIcon = <span className="assembl-icon-share color" />;
    return (
      <div className="post-actions">
        <div className="post-icons">
          <div
            className="post-action"
            onClick={() =>
              openShareModal({
                type: 'post',
                title: modalTitle,
                routerParams: routerParams,
                elementId: postId,
                social: useSocial
              })
            }
          >
            <ResponsiveOverlayTrigger placement={tooltipPlacement} tooltip={sharePostTooltip} component={shareIcon} />
          </div>
          <Sentiments
            sentimentCounts={sentimentCounts}
            mySentiment={mySentiment}
            placement={tooltipPlacement}
            client={client}
            postId={postId}
            isPhaseCompleted={isPhaseCompleted}
          />
          {screenWidth >= MEDIUM_SCREEN_WIDTH ? null : overflowMenu}
        </div>
        {totalSentimentsCount > 0 ? (
          <OverlayTrigger
            overlay={getSentimentStats(totalSentimentsCount, sentimentCounts, mySentiment)}
            placement={tooltipPlacement}
          >
            <div className="sentiments-count margin-m">
              <div>
                {sentimentDefinitions.reduce((result, sentiment) => {
                  const sentimentCount = get(sentimentCounts, sentiment.camelType, 0);
                  if (sentimentCount > 0) {
                    result.push(
                      <div className="min-sentiment" key={sentiment.type} style={{ left: `${(count += 1 * 6)}px` }}>
                        <sentiment.SvgComponent size={15} />
                      </div>
                    );
                  }
                  return result;
                }, [])}
              </div>
              <div className="txt">
                {screenWidth >= MEDIUM_SCREEN_WIDTH ? (
                  totalSentimentsCount
                ) : (
                  <Translate value="debate.thread.numberOfReactions" count={totalSentimentsCount} />
                )}
              </div>
            </div>
          </OverlayTrigger>
        ) : (
          <div className="empty-sentiments-count" />
        )}
        {screenWidth >= MEDIUM_SCREEN_WIDTH ? overflowMenu : null}
        {editable && (
          <div className="answers annotation">
            <Translate value="debate.thread.numberOfResponses" count={numChildren} />
          </div>
        )}
        <div className="clear">&nbsp;</div>
      </div>
    );
  }
}

// $FlowFixMe
export default withScreenWidth(withApollo(PostActions));