<?php

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

final class B2BKing_Purchase_Order_Gateway_Blocks extends AbstractPaymentMethodType {

    private $gateway;
    protected $name = 'B2BKing_Purchase_Order_Gateway';// your payment gateway name

    public function initialize() {
        $this->settings = get_option( 'woocommerce_B2BKing_Purchase_Order_Gateway_settings', [] );
        if ( class_exists( 'B2BKing_Purchase_Order_Gateway' ) ) {
            $this->gateway = new B2BKing_Purchase_Order_Gateway();
            $this->gateway->instructions = ''; // do not show instructions twice

        }
    }

    public function is_active() {
        if ( ! class_exists( 'B2BKing_Purchase_Order_Gateway' ) ) {
            return false;
        }
        return $this->gateway->is_available();
    }

    public function get_payment_method_script_handles() {


        // Add the type="module" attribute
        add_filter('script_loader_tag', function ($tag, $handle, $src) {
            if ($handle === 'b2bking-purchase-order-gateway-integration') {
                $tag = '<script type="module" src="' . esc_url($src) . '"></script>';
            }
            return $tag;
        }, 10, 3);

        wp_register_script(
            'b2bking-purchase-order-gateway-integration',
            plugin_dir_url(__FILE__) . 'purchase-order-checkout.js',
            [   
                'wc-blocks-checkout',
                'wc-blocks-registry',
                'wc-settings',
                'wp-element',
                'wp-html-entities',
                'wp-i18n',
            ],
            null,
            true
        );
        if( function_exists( 'wp_set_script_translations' ) ) {            
            wp_set_script_translations( 'b2bking-purchase-order-gateway-integration');
        }

        $data_to_be_passed = $this->get_payment_method_data();
        wp_localize_script( 'b2bking-purchase-order-gateway-integration', 'b2bking_po_settings', $data_to_be_passed );
        
        return [ 'b2bking-purchase-order-gateway-integration' ];
    }

    public function get_payment_method_data() {

        if ( ! class_exists( 'B2BKing_Purchase_Order_Gateway' ) ) {
            return [];
        }
        $values = array(
            'title'       => $this->get_setting( 'title' ),
            'description' => $this->get_setting( 'description' ),
            'supports'    => $this->get_supported_features(),
        );

        return $values;
    }
    public function get_supported_features() {
        $payment_gateways = WC()->payment_gateways->payment_gateways();
        return $payment_gateways[ $this->name ]->supports;
    }

}
?>