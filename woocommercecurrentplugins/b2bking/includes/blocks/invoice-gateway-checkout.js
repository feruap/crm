const b2bking_settings_invoice = window.wc.wcSettings.getSetting( 'b2bking-invoice-gateway_data', {} );
const b2bking_invoice_label = window.wp.htmlEntities.decodeEntities( b2bking_settings_invoice.title ) || window.wp.i18n.__( 'Invoice Payment', 'b2bking-invoice-gateway' );
const b2bking_invoice_content = () => {
    return window.wp.htmlEntities.decodeEntities( b2bking_settings_invoice.description || '' );
};
const B2bking_Invoice_Block_Gateway = {
    name: 'b2bking-invoice-gateway',
    label: b2bking_invoice_label,
    content: Object( window.wp.element.createElement )( b2bking_invoice_content, null ),
    edit: Object( window.wp.element.createElement )( b2bking_invoice_content, null ),
    canMakePayment: () => true,
    ariaLabel: b2bking_invoice_label,
    supports: {
        features: b2bking_settings_invoice.supports,
    },
};

window.wc.wcBlocksRegistry.registerPaymentMethod( B2bking_Invoice_Block_Gateway );