import React from 'react';
import { compose, graphql } from 'react-apollo';
import { connect } from 'react-redux';
import { get } from '../utils/routeMap';
import ExportSection from '../components/administration/exportSection';
import Navbar from '../components/administration/navbar';
import DiscussionPreferenceLanguageQuery from '../graphql/DiscussionPreferenceLanguage.graphql';

class MultiColumnsAdmin extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      exportLocale: null,
      refetching: false,
      translate: false
    };
  }

  componentDidMount() {
    this.props.router.setRouteLeaveHook(this.props.route, this.routerWillLeave);
  }

  componentWillUnmount() {
    this.props.router.setRouteLeaveHook(this.props.route, null);
  }

  handleExportLocaleChange = (locale) => {
    this.setState({ exportLocale: locale });
  };

  handleTranslationChange = (shouldTranslate) => {
    this.setState({ translate: shouldTranslate });
  };

  render() {
    const { section, languages, debateId } = this.props;
    const { translate } = this.state;
    const exportLocale = this.state.exportLocale || (languages && languages[0].locale);
    const translation = translate && exportLocale ? `?lang=${exportLocale}` : '?';
    const exportLink = get('exportThreadMulticolumnData', { debateId: debateId, translation: translation });
    const currentStep = parseInt(section, 10);
    return (
      <div className="multicolumn-admin">
        {section === '1' && (
          // When the other sections of this admin will be added, this one will be the last section and not '1'
          <ExportSection
            withLanguageOptions
            handleExportLocaleChange={this.handleExportLocaleChange}
            handleTranslationChange={this.handleTranslationChange}
            exportLink={exportLink}
            translate={translate}
            exportLocale={exportLocale}
            languages={languages}
            annotation="multicolumnAnnotation"
          />
        )}
        {!isNaN(currentStep) && <Navbar currentStep={currentStep} totalSteps={1} phaseIdentifier="multiColumn" />}
      </div>
    );
  }
}

const mapStateToProps = ({ context, i18n }) => ({
  debateId: context.debateId,
  i18n: i18n
});

export default compose(
  connect(mapStateToProps),
  graphql(DiscussionPreferenceLanguageQuery, {
    options: ({ i18n: { locale } }) => ({
      variables: {
        inLocale: locale
      }
    }),
    props: ({ data }) => {
      if (data.loading) {
        return {
          loading: true
        };
      }

      if (data.error) {
        return {
          hasErrors: true,
          loading: false
        };
      }
      return {
        hasErrors: false,
        languages: data.discussionPreferences.languages
      };
    }
  })
)(MultiColumnsAdmin);