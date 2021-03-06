// @flow
import * as React from 'react';
import ARange from 'annotator_range'; // eslint-disable-line
import { connect } from 'react-redux';
import { compose, graphql } from 'react-apollo';
import { Button, OverlayTrigger } from 'react-bootstrap';
import { Translate, I18n } from 'react-redux-i18n';
import classnames from 'classnames';
import moment from 'moment';

import addPostExtractMutation from '../../graphql/mutations/addPostExtract.graphql';
import updateExtractMutation from '../../graphql/mutations/updateExtract.graphql';
import deleteExtractMutation from '../../graphql/mutations/deleteExtract.graphql';
import withLoadingIndicator from '../../components/common/withLoadingIndicator';
import { getConnectedUserId, getConnectedUserName } from '../../utils/globalFunctions';
import AvatarImage from '../common/avatarImage';
import TaxonomyOverflowMenu from './taxonomyOverflowMenu';
import FormControlWithLabel from '../common/formControlWithLabel';
import { displayAlert, displayModal, closeModal } from '../../utils/utilityManager';
import { editExtractTooltip, deleteExtractTooltip, nuggetExtractTooltip, qualifyExtractTooltip } from '../common/tooltips';
import { NatureIcons, ActionIcons } from '../../utils/extractQualifier';

type Props = {
  extract: ?Extract,
  postId: string,
  contentLocale: string,
  selection: ?Object,
  setHarvestingBoxDisplay: Function,
  cancelHarvesting: Function,
  addPostExtract: Function,
  updateExtract: Function,
  deleteExtract: Function,
  refetchPost: Function,
  harvestingDate?: string,
  isAuthorAccountDeleted?: boolean
};

type State = {
  disabled: boolean,
  extractIsValidated: boolean,
  isNugget: boolean,
  isEditable: boolean,
  editableExtract: string,
  extractNature: ?string,
  extractAction: ?string,
  showOverflowMenu: boolean,
  overflowMenu: ?HTMLElement,
  overflowMenuTop: number
};

type Taxonomies = {
  nature: ?string,
  action: ?string
};

class DumbHarvestingBox extends React.Component<Props, State> {
  menu: any;

  static defaultProps = {
    harvestingDate: null,
    isAuthorAccountDeleted: false
  };

  constructor(props: Props) {
    super(props);
    const { extract } = this.props;
    const isExtract = extract !== null;
    const isNugget = extract ? extract.important : false;
    this.state = {
      disabled: !isExtract,
      extractIsValidated: isExtract,
      isNugget: isNugget,
      isEditable: false,
      editableExtract: extract ? extract.body : '',
      extractNature: extract && extract.extractNature ? extract.extractNature.split('.')[1] : null,
      extractAction: extract && extract.extractAction ? extract.extractAction.split('.')[1] : null,
      showOverflowMenu: false,
      overflowMenu: null,
      overflowMenuTop: 25
    };
  }

  componentDidMount() {
    window.addEventListener('scroll', this.updateOverflowMenuPosition);
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.updateOverflowMenuPosition);
  }

  setEditMode = (): void => {
    const { isEditable } = this.state;
    this.setState({ isEditable: !isEditable });
  };

  editExtract = (value: string): void => {
    this.setState({ editableExtract: value });
  };

  qualifyExtract = (taxonomies: Taxonomies): void => {
    this.setState({ showOverflowMenu: false });
    const { nature, action } = taxonomies;
    const { extract, updateExtract, refetchPost } = this.props;
    const { isNugget } = this.state;
    const variables = {
      extractId: extract ? extract.id : null,
      important: isNugget,
      extractNature: nature,
      extractAction: action
    };
    displayAlert('success', I18n.t('loading.wait'));
    updateExtract({ variables: variables })
      .then(() => {
        this.setState({ extractNature: nature, extractAction: action });
        displayAlert('success', I18n.t('harvesting.harvestingSuccess'));
        refetchPost();
      })
      .catch((error) => {
        displayAlert('danger', `${error}`);
      });
  };

  updateHarvestingNugget = (): void => {
    const { extract, updateExtract, refetchPost } = this.props;
    const { isNugget, extractNature, extractAction } = this.state;
    const variables = {
      extractId: extract ? extract.id : null,
      important: !isNugget,
      extractNature: extractNature,
      extractAction: extractAction
    };
    displayAlert('success', I18n.t('loading.wait'));
    updateExtract({ variables: variables })
      .then(() => {
        this.setState({
          isNugget: !isNugget
        });
        displayAlert('success', I18n.t('harvesting.harvestingSuccess'));
        refetchPost();
      })
      .catch((error) => {
        displayAlert('danger', `${error}`);
      });
  };

  updateHarvestingBody = (): void => {
    const { extract, updateExtract, refetchPost } = this.props;
    const { editableExtract, isNugget, extractNature, extractAction } = this.state;
    const variables = {
      extractId: extract ? extract.id : null,
      body: editableExtract,
      important: isNugget,
      extractNature: extractNature,
      extractAction: extractAction
    };
    displayAlert('success', I18n.t('loading.wait'));
    updateExtract({ variables: variables })
      .then(() => {
        this.setState({
          isEditable: false
        });
        displayAlert('success', I18n.t('harvesting.harvestingSuccess'));
        refetchPost();
      })
      .catch((error) => {
        displayAlert('danger', `${error}`);
      });
  };

  confirmHarvestingDeletion = (): void => {
    const modalTitle = <Translate value="harvesting.deleteExtract" />;
    const body = <Translate value="harvesting.confirmDeleteExtract" />;
    const footer = [
      <Button key="cancel" onClick={closeModal} className="button-cancel button-dark">
        <Translate value="debate.confirmDeletionButtonCancel" />
      </Button>,
      <Button key="delete" onClick={this.deleteHarvesting} className="button-submit button-dark">
        <Translate value="validate" />
      </Button>
    ];
    const includeFooter = true;
    return displayModal(modalTitle, body, includeFooter, footer);
  };

  deleteHarvesting = (): void => {
    const { extract, deleteExtract, refetchPost } = this.props;
    const variables = {
      extractId: extract ? extract.id : null
    };
    closeModal();
    displayAlert('success', I18n.t('loading.wait'));
    deleteExtract({ variables: variables })
      .then(() => {
        displayAlert('success', I18n.t('harvesting.harvestingDeleted'));
        refetchPost();
      })
      .catch((error) => {
        displayAlert('danger', `${error}`);
      });
  };

  validateHarvesting = (): void => {
    const { postId, selection, contentLocale, addPostExtract, setHarvestingBoxDisplay, refetchPost } = this.props;
    if (!selection) {
      return;
    }
    const selectionText = selection.toString();
    const annotatorRange = ARange.sniff(selection.getRangeAt(0));
    if (!annotatorRange) {
      return;
    }
    const serializedAnnotatorRange = annotatorRange.serialize(document, 'annotation');
    if (!serializedAnnotatorRange) {
      return;
    }
    const variables = {
      contentLocale: contentLocale,
      postId: postId,
      body: selectionText,
      important: false,
      xpathStart: serializedAnnotatorRange.start,
      xpathEnd: serializedAnnotatorRange.end,
      offsetStart: serializedAnnotatorRange.startOffset,
      offsetEnd: serializedAnnotatorRange.endOffset
    };
    displayAlert('success', I18n.t('loading.wait'));
    addPostExtract({ variables: variables })
      .then(() => {
        this.setState({
          disabled: false,
          extractIsValidated: true
        });
        setHarvestingBoxDisplay();
        window.getSelection().removeAllRanges();
        refetchPost();
      })
      .catch((error) => {
        displayAlert('danger', `${error}`);
      });
  };

  showValidatedHarvesting = (nature: ?string, action: ?string) => {
    if (nature && action) {
      return (
        <div className="harvesting-taxonomy-label">
          {`${I18n.t(`search.taxonomy_nature.${nature}`)} + ${I18n.t(`search.taxonomy_action.${action}`)}`}
        </div>
      );
    } else if (nature) {
      return <div className="harvesting-taxonomy-label">{I18n.t(`search.taxonomy_nature.${nature}`)}</div>;
    }
    return action ? <div className="harvesting-taxonomy-label">{I18n.t(`search.taxonomy_action.${action}`)}</div> : null;
  };

  updateOverflowMenu = (node: HTMLElement) => {
    if (node) {
      this.setState({ overflowMenu: node });
    }
  };

  updateOverflowMenuPosition = () => {
    const { overflowMenu } = this.state;
    if (overflowMenu) {
      const height = overflowMenu.clientHeight;
      const bottomScroll = window.pageYOffset + height;
      const windowHeight = document.body && document.body.scrollHeight;
      const isBottomReached = windowHeight && bottomScroll >= windowHeight - window.innerHeight;
      if (isBottomReached) {
        this.setState({ overflowMenuTop: -320 });
      } else {
        this.setState({ overflowMenuTop: 25 });
      }
    }
  };

  render() {
    const { selection, cancelHarvesting, extract, contentLocale, harvestingDate, isAuthorAccountDeleted } = this.props;
    const {
      disabled,
      extractIsValidated,
      isNugget,
      isEditable,
      editableExtract,
      extractNature,
      extractAction,
      showOverflowMenu,
      overflowMenuTop
    } = this.state;
    const isExtract = extract !== null;
    const selectionText = selection ? selection.toString() : '';
    const harvesterUserName =
      extract && extract.creator && extract.creator.displayName ? extract.creator.displayName : getConnectedUserName();
    const userName = isAuthorAccountDeleted ? I18n.t('deletedUser') : harvesterUserName;
    const harvesterUserId = extract && extract.creator && extract.creator.userId ? extract.creator.userId : getConnectedUserId();
    return (
      <div>
        {(extractNature || extractAction) && (
          <div>
            <div className="box-icon">
              {extractNature && <NatureIcons qualifier={extractNature} />}
              {extractAction && !extractNature && <ActionIcons qualifier={extractAction} backgroundColor="#fff" color="#000" />}
            </div>
            {extractNature &&
              extractAction && (
                <div className="box-icon box-icon-2">
                  <ActionIcons qualifier={extractAction} backgroundColor="#fff" color="#000" />
                </div>
              )}
          </div>
        )}
        <div className={classnames('theme-box', 'harvesting-box', { 'active-box': extractIsValidated })}>
          <div className="harvesting-box-header">
            <div className="harvesting-status">
              {disabled ? (
                <div className="harvesting-in-progress">
                  <div className="harvesting-status-label">
                    <Translate value="harvesting.inProgress" />
                  </div>
                </div>
              ) : (
                <div>
                  {extractNature || extractAction ? (
                    <div className="validated-harvesting">{this.showValidatedHarvesting(extractNature, extractAction)}</div>
                  ) : (
                    <div className="validated-harvesting">
                      <div className="harvesting-status-label">
                        <Translate value="harvesting.validated" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="button-bar">
              <OverlayTrigger placement="top" overlay={editExtractTooltip}>
                <Button disabled={disabled} onClick={this.setEditMode} className={classnames({ active: isEditable })}>
                  <span className="assembl-icon-edit grey" />
                </Button>
              </OverlayTrigger>
              <OverlayTrigger placement="top" overlay={deleteExtractTooltip}>
                <Button disabled={disabled} onClick={this.confirmHarvestingDeletion}>
                  <span className="assembl-icon-delete grey" />
                </Button>
              </OverlayTrigger>
              <OverlayTrigger placement="top" overlay={nuggetExtractTooltip}>
                <Button disabled={disabled} onClick={this.updateHarvestingNugget} className={classnames({ active: isNugget })}>
                  <span className="assembl-icon-pepite grey" />
                </Button>
              </OverlayTrigger>
              <OverlayTrigger placement="top" overlay={qualifyExtractTooltip}>
                <Button
                  disabled={disabled}
                  className="taxonomy-menu-btn"
                  onClick={() => {
                    this.setState({ showOverflowMenu: !showOverflowMenu });
                  }}
                >
                  <span className="assembl-icon-ellipsis-vert grey" />
                </Button>
              </OverlayTrigger>
              {showOverflowMenu && (
                <TaxonomyOverflowMenu
                  innerRef={this.updateOverflowMenu}
                  handleClick={this.qualifyExtract}
                  extractNature={extractNature}
                  extractAction={extractAction}
                  onCloseClick={() => {
                    this.setState({ showOverflowMenu: false });
                  }}
                  top={overflowMenuTop}
                />
              )}
            </div>
            <div className="profile">
              <AvatarImage userId={harvesterUserId} userName={userName} />
              <div className="harvesting-infos">
                <div className="username">{userName}</div>
                {isExtract &&
                  extract &&
                  extract.creationDate && (
                    <div className="harvesting-date" title={extract.creationDate}>
                      {harvestingDate ||
                        moment(extract.creationDate)
                          .locale(contentLocale)
                          .fromNow()}
                    </div>
                  )}
                {!isExtract && (
                  <div className="harvesting-date">
                    <Translate value="harvesting.now" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="harvesting-box-body">
            {isExtract && extract && !isEditable && <div>{extract.body}</div>}
            {isExtract &&
              extract &&
              isEditable && (
                <FormControlWithLabel
                  label=""
                  componentClass="textarea"
                  className="text-area"
                  value={editableExtract}
                  onChange={e => this.editExtract(e.target.value)}
                />
              )}
            {!isExtract && <div>{selectionText}</div>}
          </div>
          {(disabled || isEditable) && (
            <div className="harvesting-box-footer">
              <Button className="button-cancel button-dark" onClick={isEditable ? this.setEditMode : cancelHarvesting}>
                <Translate value="debate.confirmDeletionButtonCancel" />
              </Button>
              <Button
                className="button-submit button-dark"
                onClick={isEditable ? this.updateHarvestingBody : this.validateHarvesting}
              >
                <Translate value="common.attachFileForm.submit" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export { DumbHarvestingBox };

const mapStateToProps = state => ({
  contentLocale: state.i18n.locale
});

export default compose(
  connect(mapStateToProps),
  graphql(addPostExtractMutation, {
    name: 'addPostExtract'
  }),
  graphql(updateExtractMutation, {
    name: 'updateExtract'
  }),
  graphql(deleteExtractMutation, {
    name: 'deleteExtract'
  }),
  withLoadingIndicator()
)(DumbHarvestingBox);