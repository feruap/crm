<?php

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

final class B2BKing_Invoice_Gateway_Blocks extends AbstractPaymentMethodType {

    private $gateway;
    protected $name = 'b2bking-invoice-gateway';// your payment gateway name

    public function initialize() {
        $this->settings = get_option( 'woocommerce_b2bking-invoice-gateway_settings', [] );
        if ( class_exists( 'B2BKing_Invoice_Gateway' ) ) {
            $this->gateway = new B2BKing_Invoice_Gateway();
            $this->gateway->instructions = ''; // do not show instructions twice
        }
    }

    public function is_active() {
        if ( ! class_exists( 'B2BKing_Invoice_Gateway' ) ) {
            return false;
        }
        return $this->gateway->is_available();
    }

    public function get_payment_method_script_handles() {

        wp_register_script(
            'b2bking-invoice-gateway-integration',
            plugin_dir_url(__FILE__) . 'invoice-gateway-checkout.js',
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
            wp_set_script_translations( 'b2bking-invoice-gateway-integration');
        }
        
        return [ 'b2bking-invoice-gateway-integration' ];
    }

    public function get_payment_method_data() {
        if ( ! class_exists( 'B2BKing_Invoice_Gateway' ) ) {
            return [];
        }
        return [
            'title' => $this->gateway->title,
            'description' => $this->gateway->description,
            'supports'    => $this->get_supported_features(),
        ];
    }

    public function get_supported_features() {
        $payment_gateways = WC()->payment_gateways->payment_gateways();
        return $payment_gateways[ $this->name ]->supports;
    }
}
?>