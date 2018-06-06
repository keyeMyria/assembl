import React from 'react';
import { Translate } from 'react-redux-i18n';
import { compose, graphql } from 'react-apollo';
import { filter } from 'graphql-anywhere';
import { Grid, Row, Col } from 'react-bootstrap';
import { connect } from 'react-redux';

import { updateThematics, displayLanguageMenu } from '../actions/adminActions';
import { updateResources, updateResourcesCenterPage } from '../actions/adminActions/resourcesCenter';
import { updateVoteSessionPage, updateVoteModules, updateVoteProposals } from '../actions/adminActions/voteSession';
import { updateSections } from '../actions/adminActions/adminSections';
import { updateLegalContents } from '../actions/adminActions/legalContents';
import { updateLandingPageModules, updateLandingPage } from '../actions/adminActions/landingPage';
import { updateTextFields } from '../actions/adminActions/profileOptions';
import withLoadingIndicator from '../components/common/withLoadingIndicator';
import Menu from '../components/administration/menu';
import LanguageMenu from '../components/administration/languageMenu';
import ThematicsQuery from '../graphql/ThematicsQuery.graphql';
import ResourcesQuery from '../graphql/ResourcesQuery.graphql';
import ResourcesCenterPage from '../graphql/ResourcesCenterPage.graphql';
import SectionsQuery from '../graphql/SectionsQuery.graphql';
import TabsConditionQuery from '../graphql/TabsConditionQuery.graphql';
import TextFields from '../graphql/TextFields.graphql';
import LegalContentsQuery from '../graphql/LegalContents.graphql';
import VoteSessionQuery from '../graphql/VoteSession.graphql';
import LandingPageQuery from '../graphql/LandingPage.graphql';
import { convertEntriesToRawContentState } from '../utils/draftjs';
import { getPhaseId } from '../utils/timeline';
import landingPagePlugin from '../utils/administration/landingPage';

export function convertVideoDescriptions(thematics) {
  return thematics.map((t) => {
    if (!t.video) {
      return t;
    }

    return {
      ...t,
      video: {
        ...t.video,
        descriptionEntriesBottom: t.video.descriptionEntriesBottom
          ? convertEntriesToRawContentState(t.video.descriptionEntriesBottom)
          : null,
        descriptionEntriesSide: t.video.descriptionEntriesSide
          ? convertEntriesToRawContentState(t.video.descriptionEntriesSide)
          : null,
        descriptionEntriesTop: t.video.descriptionEntriesTop
          ? convertEntriesToRawContentState(t.video.descriptionEntriesTop)
          : null
      }
    };
  });
}

class Administration extends React.Component {
  constructor(props) {
    super(props);
    this.putResourcesCenterInStore = this.putResourcesCenterInStore.bind(this);
    this.putThematicsInStore = this.putThematicsInStore.bind(this);
    this.putLegalContentsInStore = this.putLegalContentsInStore.bind(this);
    this.putVoteSessionInStore = this.putVoteSessionInStore.bind(this);
    this.putLandingPageModulesInStore = this.putLandingPageModulesInStore.bind(this);
    this.putTextFieldsInStore = this.putTextFieldsInStore.bind(this);
    this.putLandingPageInStore = this.putLandingPageInStore.bind(this);
    this.state = {
      showLanguageMenu: true
    };
  }

  componentDidMount() {
    // we need to use the redux store for administration data to be able to use a
    // "global" save button that will do all the mutations "at once"
    this.putResourcesCenterInStore(this.props.resourcesCenter);
    this.putResourcesInStore(this.props.resources);
    this.putThematicsInStore(this.props.data);
    this.putSectionsInStore(this.props.sections);
    this.putLegalContentsInStore(this.props.legalContents);
    this.putVoteSessionInStore(this.props.voteSession);
    this.putVoteModulesInStore(this.props.voteSession);
    this.putVoteProposalsInStore(this.props.voteSession);
    const isHidden = this.props.identifier === 'discussion' && this.props.location.query.section === '1';
    this.props.displayLanguageMenu(isHidden);
    this.putLandingPageModulesInStore(this.props.landingPageModules);
    this.putTextFieldsInStore(this.props.textFields);
    this.putLandingPageInStore(this.props.landingPage);
  }

  componentWillReceiveProps(nextProps) {
    // update thematics in store after a mutation has been executed
    if (nextProps.data.thematics !== this.props.data.thematics) {
      this.putThematicsInStore(nextProps.data);
    }

    if (nextProps.resources !== this.props.resources) {
      this.putResourcesInStore(nextProps.resources);
    }

    if (nextProps.sections !== this.props.sections) {
      this.putSectionsInStore(nextProps.sections);
    }

    if (nextProps.voteSession !== this.props.voteSession) {
      this.putVoteSessionInStore(nextProps.voteSession);
      this.putVoteModulesInStore(nextProps.voteSession);
      this.putVoteProposalsInStore(nextProps.voteSession);
    }

    this.putResourcesCenterInStore(nextProps.resourcesCenter);

    if (nextProps.landingPageModules !== this.props.landingPageModules) {
      this.putLandingPageModulesInStore(nextProps.landingPageModules);
    }

    const isHidden = nextProps.identifier === 'discussion' && nextProps.location.query.section === '1';
    this.props.displayLanguageMenu(isHidden);

    if (nextProps.textFields !== this.props.textFields) {
      this.putTextFieldsInStore(nextProps.textFields);
    }

    if (nextProps.legalContents !== this.props.legalContents) {
      this.putLegalContentsInStore(nextProps.legalContents);
    }

    if (nextProps.landingPage !== this.props.landingPage) {
      this.putLandingPageInStore(nextProps.landingPage);
    }
  }

  putThematicsInStore(data) {
    // filter with the same query to remove stuff like __typename from the structure
    const filteredThematics = filter(ThematicsQuery, data);
    const thematics = convertVideoDescriptions(filteredThematics.thematics);
    this.props.updateThematics(thematics);
  }

  putResourcesInStore(resources) {
    const filteredResources = filter(ResourcesQuery, { resources: resources });
    const resourcesForStore = filteredResources.resources.map(resource => ({
      ...resource,
      textEntries: resource.textEntries ? convertEntriesToRawContentState(resource.textEntries) : null
    }));
    this.props.updateResources(resourcesForStore);
  }

  putResourcesCenterInStore(resourcesCenter) {
    const filteredResourcesCenter = filter(ResourcesCenterPage, { resourcesCenter: resourcesCenter });
    this.props.updateResourcesCenterPage(filteredResourcesCenter.resourcesCenter);
  }

  putVoteSessionInStore(voteSession) {
    const emptyVoteSession = {
      id: '',
      titleEntries: [],
      seeCurrentVotes: false,
      subTitleEntries: [],
      instructionsSectionTitleEntries: [],
      instructionsSectionContentEntries: [],
      propositionsSectionTitleEntries: [],
      headerImage: {
        externalUrl: '',
        mimeType: '',
        title: ''
      },
      publicVote: true,
      modules: []
    };
    const filteredVoteSession = filter(VoteSessionQuery, { voteSession: voteSession || emptyVoteSession });
    const voteSessionForStore = {
      ...filteredVoteSession.voteSession,
      instructionsSectionContentEntries: filteredVoteSession.voteSession.instructionsSectionContentEntries
        ? convertEntriesToRawContentState(filteredVoteSession.voteSession.instructionsSectionContentEntries)
        : null
    };
    this.props.updateVoteSessionPage(voteSessionForStore);
  }

  putVoteModulesInStore(voteSession) {
    const filteredVoteSession = filter(VoteSessionQuery, { voteSession: voteSession });
    const modules =
      filteredVoteSession.voteSession && filteredVoteSession.voteSession.modules ? filteredVoteSession.voteSession.modules : [];
    this.props.updateVoteModules(modules);
  }

  putVoteProposalsInStore(voteSession) {
    const proposals = voteSession ? filter(VoteSessionQuery, { voteSession: voteSession }).voteSession.proposals : [];
    const proposalsForStore = proposals.map(proposal => ({
      ...proposal,
      descriptionEntries: proposal.descriptionEntries ? convertEntriesToRawContentState(proposal.descriptionEntries) : null
    }));
    this.props.updateVoteProposals(proposalsForStore);
  }

  putSectionsInStore(sections) {
    const filteredSections = filter(SectionsQuery, {
      sections: sections.filter(section => section.sectionType !== 'ADMINISTRATION')
    });
    this.props.updateSections(filteredSections.sections);
  }

  putLegalContentsInStore(legalContents) {
    const filtered = filter(LegalContentsQuery, { legalContents: legalContents });
    const filteredLegalContents = filtered.legalContents;
    const convertedLegalContents = {
      legalNoticeEntries: filteredLegalContents.legalNoticeEntries
        ? convertEntriesToRawContentState(filteredLegalContents.legalNoticeEntries)
        : null,
      termsAndConditionsEntries: filteredLegalContents.termsAndConditionsEntries
        ? convertEntriesToRawContentState(filteredLegalContents.termsAndConditionsEntries)
        : null,
      cookiesPolicyEntries: filteredLegalContents.cookiesPolicyEntries
        ? convertEntriesToRawContentState(filteredLegalContents.cookiesPolicyEntries)
        : null,
      privacyPolicyEntries: filteredLegalContents.privacyPolicyEntries
        ? convertEntriesToRawContentState(filteredLegalContents.privacyPolicyEntries)
        : null
    };
    this.props.updateLegalContents(convertedLegalContents);
  }

  putLandingPageModulesInStore(landingPageModules) {
    const filtered = filter(landingPagePlugin.graphqlQuery, { landingPageModules: landingPageModules });
    this.props.updateLandingPageModules(filtered.landingPageModules);
  }

  putTextFieldsInStore(textFields) {
    if (textFields) {
      const filtered = filter(TextFields, { textFields: textFields });
      this.props.updateTextFields(filtered.textFields);
    }
  }

  putLandingPageInStore(landingPage) {
    this.props.updateLandingPage(landingPage);
  }

  render() {
    const {
      children,
      data,
      debate,
      i18n,
      params,
      refetchResources,
      refetchResourcesCenter,
      refetchTabsConditions,
      refetchSections,
      refetchLegalContents,
      refetchVoteSession,
      refetchLandingPageModules,
      refetchTextFields,
      refetchLandingPage
    } = this.props;
    const { phase } = params;
    const { timeline } = this.props.debate.debateData;
    const childrenWithProps = React.Children.map(children, child =>
      React.cloneElement(child, {
        locale: i18n.locale,
        refetchTabsConditions: refetchTabsConditions,
        refetchThematics: data.refetch,
        refetchResources: refetchResources,
        refetchVoteSession: refetchVoteSession,
        refetchSections: refetchSections,
        refetchResourcesCenter: refetchResourcesCenter,
        refetchLandingPageModules: refetchLandingPageModules,
        refetchLegalContents: refetchLegalContents,
        refetchTextFields: refetchTextFields,
        refetchLandingPage: refetchLandingPage
      })
    );
    return (
      <div className="administration">
        <div className="save-bar">
          <div className="max-container">
            <Grid fluid>
              <Row>
                <Col xs={12} md={3} />
                <Col xs={12} md={8}>
                  {/* save button is moved here in css */}
                </Col>
                <Col xs={12} md={1} />
              </Row>
            </Grid>
          </div>
        </div>
        <div className="max-container">
          <Grid fluid>
            <Row>
              <Col xs={12} md={3}>
                <div className="admin-menu-container">
                  <Menu debate={debate} i18n={i18n} requestedPhase={phase} />
                </div>
              </Col>
              <Col xs={12} md={8}>
                {!timeline ? (
                  <div>
                    <Translate value="administration.noTimeline" />
                  </div>
                ) : null}
                {childrenWithProps}
              </Col>
              <Col xs={12} md={1}>
                <LanguageMenu />
              </Col>
            </Row>
          </Grid>
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  debate: state.debate,
  i18n: state.i18n
});

const mapDispatchToProps = dispatch => ({
  updateResources: resources => dispatch(updateResources(resources)),
  updateSections: sections => dispatch(updateSections(sections)),
  updateThematics: thematics => dispatch(updateThematics(thematics)),
  updateResourcesCenterPage: ({ titleEntries, headerImage }) => {
    dispatch(updateResourcesCenterPage(titleEntries, headerImage));
  },
  updateVoteModules: voteModules => dispatch(updateVoteModules(voteModules)),
  updateVoteSessionPage: voteSession => dispatch(updateVoteSessionPage(voteSession)),
  updateVoteProposals: voteProposals => dispatch(updateVoteProposals(voteProposals)),
  updateLegalContents: legalContents => dispatch(updateLegalContents(legalContents)),
  displayLanguageMenu: isHidden => dispatch(displayLanguageMenu(isHidden)),
  updateLandingPageModules: landingPageModules => dispatch(updateLandingPageModules(landingPageModules)),
  updateTextFields: textFields => dispatch(updateTextFields(textFields)),
  updateLandingPage: landingPage => dispatch(updateLandingPage(landingPage))
});

const mergeLoadingAndHasErrors = WrappedComponent => (props) => {
  const {
    data,
    resourcesHasErrors,
    resourcesCenterHasErrors,
    resourcesLoading,
    voteSessionHasErrors,
    voteSessionLoading,
    resourcesCenterLoading,
    sectionsHasErrors,
    sectionsLoading,
    tabsConditionsLoading,
    tabsConditionsHasErrors,
    legalContentsLoading,
    legalContentsHasErrors,
    textFieldsLoading,
    textFieldsHasErrors,
    landingPageHasErrors,
    landingPageLoading
  } = props;

  const hasErrors =
    voteSessionHasErrors ||
    resourcesHasErrors ||
    resourcesCenterHasErrors ||
    tabsConditionsHasErrors ||
    legalContentsHasErrors ||
    landingPageHasErrors ||
    sectionsHasErrors ||
    props[landingPagePlugin.hasErrors] ||
    textFieldsHasErrors ||
    (data && data.error);
  const loading =
    voteSessionLoading ||
    resourcesLoading ||
    resourcesCenterLoading ||
    tabsConditionsLoading ||
    legalContentsLoading ||
    landingPageLoading ||
    sectionsLoading ||
    props[landingPagePlugin.loading] ||
    textFieldsLoading ||
    (data && data.loading);

  return <WrappedComponent {...props} hasErrors={hasErrors} loading={loading} />;
};

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  graphql(ThematicsQuery, {
    options: { variables: { identifier: 'survey' } }
  }),
  graphql(TabsConditionQuery, {
    options: ({ i18n }) => ({
      variables: { lang: i18n.locale }
    }),
    // pass refetchTabsConditions to re-render navigation menu if there is a change in resources
    props: ({ data }) => {
      if (data.loading) {
        return {
          tabsConditionsLoading: true
        };
      }
      if (data.error) {
        return {
          tabsConditionsHasErrors: true
        };
      }

      return {
        refetchTabsConditions: data.refetch
      };
    }
  }),
  graphql(VoteSessionQuery, {
    skip: ({ debate }) => typeof getPhaseId(debate.debateData.timeline, 'voteSession') !== 'string',
    options: ({ debate, i18n }) => ({
      variables: { discussionPhaseId: getPhaseId(debate.debateData.timeline, 'voteSession'), lang: i18n.locale }
    }),
    props: ({ data }) => {
      if (data.loading) {
        return {
          voteSessionLoading: true
        };
      }
      if (data.error) {
        return {
          voteSessionHasErrors: true
        };
      }

      return {
        voteSessionLoading: data.loading,
        voteSessionHasErrors: data.error,
        voteSession: data.voteSession,
        refetchVoteSession: data.refetch
      };
    }
  }),
  graphql(ResourcesQuery, {
    props: ({ data }) => {
      if (data.loading) {
        return {
          resourcesLoading: true
        };
      }
      if (data.error) {
        return {
          resourcesHasErrors: true
        };
      }

      return {
        resourcesLoading: data.loading,
        resourcesHasErrors: data.error,
        refetchResources: data.refetch,
        resources: data.resources
      };
    }
  }),
  graphql(ResourcesCenterPage, {
    props: ({ data }) => {
      if (data.loading) {
        return {
          resourcesCenterLoading: true
        };
      }
      if (data.error) {
        return {
          resourcesCenterHasErrors: true
        };
      }

      const { headerImage, titleEntries } = data.resourcesCenter;
      return {
        resourcesCenterLoading: data.loading,
        resourcesCenterHasErrors: data.error,
        refetchResourcesCenter: data.refetch,
        resourcesCenter: {
          headerImage: headerImage,
          titleEntries: titleEntries
        }
      };
    }
  }),
  graphql(SectionsQuery, {
    props: ({ data }) => {
      if (data.loading) {
        return {
          sectionsLoading: true
        };
      }

      if (data.error) {
        return {
          sectionsHasErrors: true
        };
      }

      return {
        sectionsLoading: data.loading,
        sectionsHasErrors: data.error,
        refetchSections: data.refetch,
        sections: data.sections
      };
    }
  }),
  graphql(LegalContentsQuery, {
    props: ({ data }) => {
      if (data.loading) {
        return {
          legalContentsLoading: true
        };
      }
      if (data.error) {
        return {
          legalContentsHasErrors: true
        };
      }

      return {
        legalContentsLoading: data.loading,
        legalContentsHasErrors: data.error,
        refetchLegalContents: data.refetch,
        legalContents: data.legalContents
      };
    }
  }),
  graphql(landingPagePlugin.graphqlQuery, { options: landingPagePlugin.queryOptions, props: landingPagePlugin.dataToProps }),
  graphql(TextFields, {
    options: ({ i18n }) => ({
      variables: { lang: i18n.locale }
    }),
    props: ({ data }) => {
      if (data.loading) {
        return {
          textFieldsLoading: true
        };
      }

      if (data.error) {
        return {
          textFieldsHasErrors: true
        };
      }

      return {
        textFieldsLoading: data.loading,
        textFieldsHasErrors: data.error,
        refetchTextFields: data.refetch,
        textFields: data.textFields
      };
    },
    skip: (props) => {
      const currentLocation = props.router.getCurrentLocation();
      return !currentLocation.pathname.endsWith('discussion') || currentLocation.search !== '?section=3';
    }
  }),
  graphql(LandingPageQuery, {
    options: ({ i18n }) => ({
      variables: { lang: i18n.locale }
    }),
    props: ({ data }) => {
      if (data.loading) {
        return {
          landingPageLoading: true
        };
      }
      if (data.error) {
        return {
          landingPageHasErrors: true
        };
      }

      return {
        landingPageLoading: data.loading,
        landingPageHasErrors: data.error,
        refetchLandingPage: data.refetch,
        landingPage: data.discussion
      };
    }
  }),
  mergeLoadingAndHasErrors,
  withLoadingIndicator()
)(Administration);