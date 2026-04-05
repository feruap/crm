const { registerCheckoutBlockComponent } = window.wc.wcBlocksCheckout;
const { TextControl } = window.wp.components;

const MyCustomField = ({ onChange, ...props }) => (
  <TextControl
    label="Custom Field"
    onChange={onChange}
    {...props}
  />
);

registerCheckoutBlockComponent(MyCustomField);
