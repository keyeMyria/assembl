// @flow
import { fromJS, List, Map } from 'immutable';
import { combineReducers } from 'redux';
import type ReduxAction from 'redux';

import { type Action } from '../../actions/actionTypes';
import legalContents from './legalContents';
import resourcesCenter from './resourcesCenter';
import sections from './adminSections';
import voteSession from './voteSession';
import landingPage from './landingPage';
import profileOptions from './profileOptions';
import { updateInLangstringEntries } from '../../utils/i18n';
import { moveItemDown, moveItemUp } from '../../utils/globalFunctions';

type EditLocaleState = string;
type EditLocaleReducer = (EditLocaleState, ReduxAction<Action>) => EditLocaleState;
/*
  The locale that is used to edit the content in the administration
*/
export const editLocale: EditLocaleReducer = (state = 'fr', action) => {
  switch (action.type) {
  case 'UPDATE_EDIT_LOCALE':
    return action.newLocale;
  default:
    return state;
  }
};

type ThematicsByIdState = Map;
type ThematicsByIdReducer = (ThematicsByIdState, ReduxAction<Action>) => ThematicsByIdState;
export const thematicsById: ThematicsByIdReducer = (state = Map(), action) => {
  switch (action.type) {
  case 'ADD_QUESTION_TO_THEMATIC': {
    const newQuestion = fromJS({
      titleEntries: [{ localeCode: action.locale, value: '' }]
    });
    return state
      .updateIn([action.id, 'questions'], questions => questions.push(newQuestion))
      .setIn([action.id, '_hasChanged'], true);
  }
  case 'CREATE_NEW_THEMATIC': {
    const emptyThematic = Map({
      _hasChanged: false,
      _isNew: true,
      _toDelete: false,
      img: Map({
        externalUrl: ''
      }),
      questions: List(),
      titleEntries: List(),
      video: null
    });
    const order = state.size + 1.0;
    return state.set(action.id, emptyThematic.set('id', action.id).set('order', order));
  }
  case 'DELETE_THEMATIC':
    return state.setIn([action.id, '_toDelete'], true);
  case 'MOVE_THEMATIC_UP':
    return moveItemUp(state, action.id);
  case 'MOVE_THEMATIC_DOWN':
    return moveItemDown(state, action.id);
  case 'REMOVE_QUESTION':
    return state
      .updateIn([action.thematicId, 'questions'], questions => questions.remove(action.index))
      .setIn([action.thematicId, '_hasChanged'], true);
  case 'UPDATE_QUESTION_TITLE':
    return state
      .updateIn([action.thematicId, 'questions', action.index, 'titleEntries'], (titleEntries) => {
        const titleEntryIndex = titleEntries.findIndex(entry => entry.get('localeCode') === action.locale);

        if (titleEntryIndex === -1) {
          return titleEntries.push(Map({ localeCode: action.locale, value: action.value }));
        }

        return titleEntries.setIn([titleEntryIndex, 'value'], action.value);
      })
      .setIn([action.thematicId, '_hasChanged'], true);
  case 'UPDATE_THEMATIC_IMG_URL': {
    if (state.getIn([action.id, 'img'])) {
      return state
        .setIn([action.id, 'img', 'externalUrl'], action.value)
        .setIn([action.id, 'img', 'mimeType'], action.value.type)
        .setIn([action.id, '_hasChanged'], true);
    }

    return state
      .setIn([action.id, 'img'], Map({ mimeType: action.value.type, externalUrl: action.value }))
      .setIn([action.id, '_hasChanged'], true);
  }
  case 'UPDATE_THEMATIC_TITLE': {
    return state
      .updateIn([action.id, 'titleEntries'], updateInLangstringEntries(action.locale, action.value))
      .setIn([action.id, '_hasChanged'], true);
  }
  case 'UPDATE_THEMATICS': {
    const newState = {};
    action.thematics.forEach((t) => {
      newState[t.id] = {
        _hasChanged: false,
        ...t
      };
    });
    return fromJS(newState);
  }
  case 'TOGGLE_VIDEO':
    return state
      .updateIn([action.id, 'video'], (video) => {
        if (video) {
          return null;
        }
        return fromJS({
          descriptionEntriesTop: [],
          descriptionEntriesBottom: [],
          descriptionEntriesSide: [],
          htmlCode: '',
          titleEntries: []
        });
      })
      .setIn([action.id, '_hasChanged'], true);
  case 'UPDATE_VIDEO_DESCRIPTION_TOP':
    return state
      .updateIn([action.id, 'video', 'descriptionEntriesTop'], updateInLangstringEntries(action.locale, fromJS(action.value)))
      .setIn([action.id, '_hasChanged'], true);
  case 'UPDATE_VIDEO_DESCRIPTION_BOTTOM':
    return state
      .updateIn(
        [action.id, 'video', 'descriptionEntriesBottom'],
        updateInLangstringEntries(action.locale, fromJS(action.value))
      )
      .setIn([action.id, '_hasChanged'], true);
  case 'UPDATE_VIDEO_DESCRIPTION_SIDE':
    return state
      .updateIn([action.id, 'video', 'descriptionEntriesSide'], updateInLangstringEntries(action.locale, fromJS(action.value)))
      .setIn([action.id, '_hasChanged'], true);
  case 'UPDATE_VIDEO_HTML_CODE':
    return state.setIn([action.id, 'video', 'htmlCode'], action.value).setIn([action.id, '_hasChanged'], true);
  case 'UPDATE_VIDEO_TITLE':
    return state
      .updateIn([action.id, 'video', 'titleEntries'], updateInLangstringEntries(action.locale, action.value))
      .setIn([action.id, '_hasChanged'], true);
  default:
    return state;
  }
};

type ThematicsHaveChangedReducer = (boolean, ReduxAction<Action>) => boolean;
export const thematicsHaveChanged: ThematicsHaveChangedReducer = (state = false, action) => {
  switch (action.type) {
  case 'UPDATE_THEMATICS':
    return false;
  case 'ADD_QUESTION_TO_THEMATIC':
  case 'CREATE_NEW_THEMATIC':
  case 'DELETE_THEMATIC':
  case 'MOVE_THEMATIC_DOWN':
  case 'MOVE_THEMATIC_UP':
  case 'REMOVE_QUESTION':
  case 'UPDATE_QUESTION_TITLE':
  case 'UPDATE_THEMATIC_IMG_URL':
  case 'UPDATE_THEMATIC_TITLE':
  case 'TOGGLE_VIDEO':
  case 'UPDATE_VIDEO_DESCRIPTION_TOP':
  case 'UPDATE_VIDEO_DESCRIPTION_BOTTOM':
  case 'UPDATE_VIDEO_DESCRIPTION_SIDE':
  case 'UPDATE_VIDEO_HTML_CODE':
  case 'UPDATE_VIDEO_TITLE':
    return true;
  default:
    return state;
  }
};

const hasLocale = (l: string, arr: Array<string>): boolean => {
  const i = arr.findIndex(a => a === l);
  return i >= 0;
};

export type LanguagePreferencesState = List<string>;
type LanguagePreferencesReducer = (LanguagePreferencesState, ReduxAction<Action>) => LanguagePreferencesState;
export const languagePreferences: LanguagePreferencesReducer = (state = List(), action) => {
  switch (action.type) {
  case 'ADD_LANGUAGE_PREFERENCE':
    // Language preferences can be added in different components
    if (!hasLocale(action.locale, state)) {
      return state.push(action.locale);
    }
    return state;
  case 'REMOVE_LANGUAGE_PREFERENCE':
    if (hasLocale(action.locale, state)) {
      const i = state.findIndex(a => a === action.locale);
      return state.delete(i);
    }
    return state;
  default:
    return state;
  }
};

type DiscussionLanguagePreferencesHasChangedReducer = (boolean, ReduxAction<Action>) => boolean;
export const discussionLanguagePreferencesHasChanged: DiscussionLanguagePreferencesHasChangedReducer = (
  state = false,
  action
) => {
  switch (action.type) {
  case 'LANGUAGE_PREFERENCE_HAS_CHANGED':
    return action.state;
  default:
    return state;
  }
};

type DisplayLanguageMenuState = boolean;
type DisplayLanguageMenuReducer = (DisplayLanguageMenuState, ReduxAction<Action>) => DisplayLanguageMenuState;
export const displayLanguageMenu: DisplayLanguageMenuReducer = (state = false, action) => {
  switch (action.type) {
  case 'UPDATE_LANGUAGE_MENU_VISIBILITY':
    return action.state;
  default:
    return state;
  }
};

const reducers = {
  editLocale: editLocale,
  thematicsHaveChanged: thematicsHaveChanged,
  thematicsById: thematicsById,
  discussionLanguagePreferences: languagePreferences,
  discussionLanguagePreferencesHasChanged: discussionLanguagePreferencesHasChanged,
  displayLanguageMenu: displayLanguageMenu,
  resourcesCenter: resourcesCenter,
  sections: sections,
  voteSession: voteSession,
  legalContents: legalContents,
  landingPage: landingPage,
  profileOptions: profileOptions
};

export default combineReducers(reducers);