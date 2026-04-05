const salesking_settings_pending = window.wc.wcSettings.getSetting( 'salesking-pending-gateway_data', {} );
const salesking_pending_label = window.wp.htmlEntities.decodeEntities( salesking_settings_pending.title ) || window.wp.i18n.__( 'Pending Payment', 'salesking-pending-gateway' );
const salesking_pending_content = () => {
    return window.wp.htmlEntities.decodeEntities( salesking_settings_pending.description || '' );
};
const Salesking_Pending_Block_Gateway = {
    name: 'salesking-pending-gateway',
    label: salesking_pending_label,
    content: Object( window.wp.element.createElement )( salesking_pending_content, null ),
    edit: Object( window.wp.element.createElement )( salesking_pending_content, null ),
    canMakePayment: () => true,
    ariaLabel: salesking_pending_label,
    supports: {
        features: salesking_settings_pending.supports,
    },
};

window.wc.wcBlocksRegistry.registerPaymentMethod( Salesking_Pending_Block_Gateway );