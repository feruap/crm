<?php

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

final class B2BKing_Approval_Gateway_Blocks extends AbstractPaymentMethodType {

    private $gateway;
    protected $name = 'b2bking-approval-gateway';// your payment gateway name

    public function initialize() {
        $this->settings = get_option( 'woocommerce_b2bking-approval-gateway_settings', [] );
        if ( class_exists( 'B2BKing_Approval_Gateway' ) ) {
            $this->gateway = new B2BKing_Approval_Gateway();
            $this->gateway->instructions = ''; // do not show instructions twice

        }
    }

    public function is_active() {
        if ( ! class_exists( 'B2BKing_Approval_Gateway' ) ) {
            return false;
        }
        return $this->gateway->is_available();
    }

    public function get_payment_method_script_handles() {

        wp_register_script(
            'b2bking-approval-gateway-integration',
            plugin_dir_url(__FILE__) . 'company-approval-gateway-checkout.js',
            [
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
            wp_set_script_translations( 'b2bking-approval-gateway-integration');
        }
        
        return [ 'b2bking-approval-gateway-integration' ];
    }

    public function get_payment_method_data() {

        if ( ! class_exists( 'B2BKing_Approval_Gateway' ) ) {
            return [];
        }
        return [
            'title' => $this->gateway->title,
            'description' => $this->gateway->description,
        ];
    }

}
?>