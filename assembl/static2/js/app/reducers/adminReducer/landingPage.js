// @flow
import { fromJS, List, Map } from 'immutable';
import { combineReducers } from 'redux';
import type ReduxAction from 'redux';

import {
  type Action,
  MOVE_LANDING_PAGE_MODULE_DOWN,
  MOVE_LANDING_PAGE_MODULE_UP,
  TOGGLE_LANDING_PAGE_MODULE,
  UPDATE_LANDING_PAGE_MODULES,
  UPDATE_LANDING_PAGE
} from '../../actions/actionTypes';

type ModulesHasChangedReducer = (boolean, ReduxAction<Action>) => boolean;
export const modulesHasChanged: ModulesHasChangedReducer = (state = false, action) => {
  switch (action.type) {
  case MOVE_LANDING_PAGE_MODULE_UP:
  case MOVE_LANDING_PAGE_MODULE_DOWN:
  case TOGGLE_LANDING_PAGE_MODULE:
    return true;
  case UPDATE_LANDING_PAGE_MODULES:
    return false;
  default:
    return state;
  }
};

type EnabledModulesInOrderState = List<string>;
type EnabledModulesInOrderReducer = (EnabledModulesInOrderState, ReduxAction<Action>) => EnabledModulesInOrderState;
export const enabledModulesInOrder: EnabledModulesInOrderReducer = (state = List(), action) => {
  switch (action.type) {
  case MOVE_LANDING_PAGE_MODULE_UP: {
    const idx = state.indexOf(action.moduleTypeIdentifier);
    if (idx === 1) {
      return state;
    }
    return state.delete(idx).insert(idx - 1, action.moduleTypeIdentifier);
  }
  case MOVE_LANDING_PAGE_MODULE_DOWN: {
    const idx = state.indexOf(action.moduleTypeIdentifier);
    if (idx === state.size - 2) {
      return state;
    }

    return state.delete(idx).insert(idx + 1, action.moduleTypeIdentifier);
  }
  case TOGGLE_LANDING_PAGE_MODULE: {
    const identifier = action.moduleTypeIdentifier;
    const idx = state.indexOf(identifier);
    if (idx !== -1) {
      return state.delete(idx);
    }

    // insert at the end (just before FOOTER module)
    return state.insert(state.size - 1, identifier);
  }
  case UPDATE_LANDING_PAGE_MODULES:
    return List(action.modules.filter(module => module.enabled).map(module => module.moduleType.identifier));
  default:
    return state;
  }
};

const initialState = Map();
type ModulesByIdentifierState = Map<string, Map>;
type ModulesByIdentifierReducer = (ModulesByIdentifierState, ReduxAction<Action>) => ModulesByIdentifierState;
export const modulesByIdentifier: ModulesByIdentifierReducer = (state = initialState, action) => {
  switch (action.type) {
  case TOGGLE_LANDING_PAGE_MODULE: {
    const moduleType = action.moduleTypeIdentifier;
    return state.updateIn([moduleType, 'enabled'], v => !v);
  }
  case UPDATE_LANDING_PAGE_MODULES: {
    let newState = Map();
    action.modules.forEach((module) => {
      newState = newState.set(module.moduleType.identifier, fromJS(module));
    });
    return newState;
  }
  default:
    return state;
  }
};

const initialPage = Map({
  _hasChanged: false,
  titleEntries: List(),
  subtitleEntries: List(),
  buttonLabelEntries: List(),
  headerImage: Map({
    externalUrl: '',
    mimeType: '',
    title: ''
  }),
  logoImage: Map({
    externalUrl: '',
    mimeType: '',
    title: ''
  })
});
type PageState = Map<string, any>;
type LandingPageReducer = (PageState, ReduxAction<Action>) => PageState;
const page: LandingPageReducer = (state = initialPage, action) => {
  switch (action.type) {
  case UPDATE_LANDING_PAGE: {
    let newState = state;
    if (action.headerImage) {
      newState = newState
        .setIn(['headerImage', 'externalUrl'], action.headerImage.externalUrl)
        .setIn(['headerImage', 'mimeType'], action.headerImage.mimeType);
    }

    if (action.logoImage) {
      newState = newState
        .setIn(['logoImage', 'externalUrl'], action.logoImage.externalUrl)
        .setIn(['logoImage', 'mimeType'], action.logoImage.mimeType);
    }

    if (action.titleEntries) {
      newState = newState.set('titleEntries', fromJS(action.titleEntries));
    }

    if (action.subtitleEntries) {
      newState = newState.set('subtitleEntries', fromJS(action.subtitleEntries));
    }

    if (action.buttonLabelEntries) {
      newState = newState.set('buttonLabelEntries', fromJS(action.buttonLabelEntries));
    }

    return newState.set('_hasChanged', false);
  }
  default:
    return state;
  }
};

export type LandingPageState = {
  page: PageState,
  enabledModulesInOrder: EnabledModulesInOrderState,
  modulesByIdentifier: Map<string>,
  modulesHasChanged: boolean
};

const reducers = {
  page: page,
  enabledModulesInOrder: enabledModulesInOrder,
  modulesHasChanged: modulesHasChanged,
  modulesByIdentifier: modulesByIdentifier
};

export default combineReducers(reducers);