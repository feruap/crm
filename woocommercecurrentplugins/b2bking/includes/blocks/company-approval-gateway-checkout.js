const b2bking_settings_approval = window.wc.wcSettings.getSetting( 'b2bking-approval-gateway_data', {} );
const b2bking_approval_label = window.wp.htmlEntities.decodeEntities( b2bking_settings_approval.title ) || window.wp.i18n.__( 'Pending Company Approval', 'b2bking' );
const b2bking_approval_content = () => {
    return window.wp.htmlEntities.decodeEntities( b2bking_settings_approval.description || '' );
};
const B2bking_Approval_Block_Gateway = {
    name: 'b2bking-approval-gateway',
    label: b2bking_approval_label,
    content: Object( window.wp.element.createElement )( b2bking_approval_content, null ),
    edit: Object( window.wp.element.createElement )( b2bking_approval_content, null ),
    canMakePayment: () => true,
    ariaLabel: b2bking_approval_label,
    supports: {
        features: b2bking_settings_approval.supports,
    },
};

window.wc.wcBlocksRegistry.registerPaymentMethod( B2bking_Approval_Block_Gateway );