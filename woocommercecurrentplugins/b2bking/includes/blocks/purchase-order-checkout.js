const b2bking_settings_purchaseorder = window.wc.wcSettings.getSetting( 'B2BKing_Purchase_Order_Gateway_data', {} );
const b2bking_purchaseorder_label = window.wp.htmlEntities.decodeEntities( b2bking_settings_purchaseorder.title ) || window.wp.i18n.__( 'Purchase Oorder', 'B2BKing_Purchase_Order_Gateway' );


const b2bking_purchaseorder_content = () => {
    const description = window.wp.htmlEntities.decodeEntities(
        b2bking_settings_purchaseorder.description || ''
    );

    // Create a text input element with name and ID set to 'po_number_field'
    const inputField = window.wp.element.createElement('input', {
        type: 'text',
        placeholder: '', // You can change the placeholder text
        name: 'po_number_field',
        id: 'po_number_field'
    });

    // Create a container for the description and the input field
    return window.wp.element.createElement(
        'div',
        null,
        description,
        inputField
    );
};

const { createElement } = wp.element;
const { decodeEntities } = wp.htmlEntities;
const { __ } = wp.i18n;
const { useState, useEffect } = wp.element;
const { registerPaymentMethod } = wc.wcBlocksRegistry;
const { ValidatedTextInput } = wc.blocksCheckout;

const Content = ({ eventRegistration, emitResponse }) => {
    const [poNumber, setPONumber] = useState('');
    const { onPaymentProcessing } = eventRegistration;

    useEffect(() => {
        const unsubscribe = onPaymentProcessing(() => {
            if (!poNumber) {
                return {
                    type: emitResponse.responseTypes.ERROR,
                    message: __('P.O. Number', 'b2bking'),
                };
            }

            const paymentMethodData = { po_number_field: poNumber };
            return {
                type: emitResponse.responseTypes.SUCCESS,
                meta: { paymentMethodData },
            };
        });

        return () => unsubscribe();
    }, [poNumber, emitResponse.responseTypes, onPaymentProcessing]);

    // Create a simple text element
    const simpleText = createElement(
        'p',
        {},
        b2bking_po_settings.description
    );

    return createElement(
        wp.element.Fragment,
        {},
        simpleText,
        createElement(ValidatedTextInput, {
            id: "po_number_field",
            label: __('P.O. Number', 'b2bking'),
            value: poNumber,
            onChange: (value) => setPONumber(value),
            required: true,
        })
    );
};

// Ensure the rest of the payment method registration logic remains unchanged


const B2bking_Purchase_Order_Block_Gateway = {
    name: 'B2BKing_Purchase_Order_Gateway',
    label: b2bking_purchaseorder_label,
    content: createElement(Content, {}),
    edit: createElement(Content, {}),
    canMakePayment: () => true,
    ariaLabel: b2bking_purchaseorder_label,
    supports: {
        features: b2bking_settings_purchaseorder.supports,
    },
};

window.wc.wcBlocksRegistry.registerPaymentMethod( B2bking_Purchase_Order_Block_Gateway );

