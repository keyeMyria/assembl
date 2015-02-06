'use strict';

define(['jquery', 'models/base', 'utils/i18n', 'common/context'],
    function ($, Base, i18n, Ctx) {

        /**
         * @class PartnerOrganizationModel
         */
        var PartnerOrganizationModel = Base.Model.extend({

            /**
             * @type {String}
             */
            url: Ctx.getApiV2DiscussionUrl('partner_organizations'),

            /**
             * Defaults
             * @type {Object}
             */
            defaults: {
                id: null,
                name: '',
                description: '',
                homepage: '',
                logo: '',
                is_initiator: false
            }
        });


        /**
         * @class PartnerOrganizationCollection
         */
        var PartnerOrganizationCollection = Base.Collection.extend({
            /**
             * @type {String}
             */
            url: Ctx.getApiV2DiscussionUrl('partner_organizations'),

            /**
             * The model
             * @type {PartnerOrganizationModel}
             */
            model: PartnerOrganizationModel
        });

        return {
            Model: PartnerOrganizationModel,
            Collection: PartnerOrganizationCollection
        };

    });
