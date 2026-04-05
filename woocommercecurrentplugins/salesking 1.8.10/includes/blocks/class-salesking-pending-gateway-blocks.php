<?php

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

final class Salesking_Pending_Gateway_Blocks extends AbstractPaymentMethodType {

    private $gateway;
    protected $name = 'salesking-pending-gateway';// your payment gateway name

    public function initialize() {
        $this->settings = get_option( 'woocommerce_salesking-pending-gateway_settings', [] );
        if (class_exists('Salesking_Pending_Gateway')){
            $this->gateway = new Salesking_Pending_Gateway();
            $this->gateway->instructions = ''; // do not show instructions twice

        }
    }

    public function is_active() {
        if (!class_exists('Salesking_Pending_Gateway')){
            return false;
        }
        return $this->gateway->is_available();
    }

    public function get_payment_method_script_handles() {

        wp_register_script(
            'salesking-pending-gateway-integration',
            plugin_dir_url(__FILE__) . 'pending-gateway-checkout.js',
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
            wp_set_script_translations( 'salesking-pending-gateway-integration');
        }
        
        return [ 'salesking-pending-gateway-integration' ];
    }

    public function get_payment_method_data() {
        if (!class_exists('Salesking_Pending_Gateway')){
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