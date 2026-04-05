const b2bking_settings_credit = window.wc.wcSettings.getSetting( 'b2bking-credit-gateway_data', {} );
const b2bking_credit_label = window.wp.htmlEntities.decodeEntities( b2bking_settings_credit.title ) || window.wp.i18n.__( 'Company Credit', 'b2bking' );
const b2bking_credit_content = () => {
    // Use dangerouslySetInnerHTML to set HTML content
    return window.wp.element.createElement('div', {
        dangerouslySetInnerHTML: { __html: window.wp.htmlEntities.decodeEntities(b2bking_settings_credit.paymentfields || '') }
    });
};

const B2bking_Credit_Block_Gateway = {
    name: 'b2bking-credit-gateway',
    label: b2bking_credit_label,
    content: b2bking_credit_content(), // Create element with HTML content
    edit: b2bking_credit_content(), // You can reuse the function if edit content is the same as the main content
    canMakePayment: () => true,
    ariaLabel: b2bking_credit_label,
    supports: {
        features: b2bking_settings_credit.supports,
    },
};

window.wc.wcBlocksRegistry.registerPaymentMethod(B2bking_Credit_Block_Gateway);