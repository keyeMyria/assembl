// @flow
import React from 'react';
import type { ApolloClient } from 'react-apollo';

import { SurveyMenu, IdeasMenu } from '.';
import AllIdeasQuery from '../../../../graphql/AllIdeasQuery.graphql';
import DebateThematicsQuery from '../../../../graphql/DebateThematicsQuery.graphql';

const queries = {
  survey: DebateThematicsQuery,
  default: AllIdeasQuery
};

export function prefetchMenuQuery(client: ApolloClient, variables: Object) {
  const query = queries[variables.identifier];
  client.query({
    query: query || queries.default,
    variables: variables
  });
}

type MenuTableProps = {
  identifier: string
};

function Menu(props: MenuTableProps) {
  switch (props.identifier) {
  case 'survey':
    return <SurveyMenu {...props} />;
  default:
    return <IdeasMenu {...props} />;
  }
}

export default Menu;