<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Salesking_Pending_Gateway extends WC_Gateway_COD {

    /**
     * Setup general properties for the gateway.
     */
    protected function setup_properties() {
        $this->id                 = 'salesking-pending-gateway';
        $this->icon               = apply_filters( 'salesking_pending_gateway_icon', '' );
        $this->method_title       = esc_html__( 'Pending Payment', 'salesking' );
        $this->method_description = esc_html__( 'Allows sales agents to place "pending payment" orders, that customers will pay later.', 'salesking' );
        $this->has_fields         = false;
    }

    /**
     * Initialise Gateway Settings Form Fields.
     */
    public function init_form_fields() {
        $shipping_methods = array();

        foreach ( WC()->shipping()->load_shipping_methods() as $method ) {
            $shipping_methods[ $method->id ] = $method->get_method_title();
        }

        $this->form_fields = array(
            'enabled' => array(
                'title'       => esc_html__( 'Enable/Disable', 'salesking' ),
                'label'       => esc_html__( 'Enable orders as pending payment for sales agents', 'salesking' ),
                'type'        => 'checkbox',
                'description' => '',
                'default'     => 'no',
            ),
            'title' => array(
                'title'       => esc_html__( 'Title', 'salesking' ),
                'type'        => 'text',
                'description' => esc_html__( 'This controls the title which the user sees during checkout.', 'salesking' ),
                'default'     => esc_html__( 'Pending Payment', 'salesking' ),
                'desc_tip'    => true,
            ),
            'description' => array(
                'title'       => esc_html__( 'Description', 'salesking' ),
                'type'        => 'textarea',
                'description' => esc_html__( 'Payment method description that the customer will see on your website.', 'salesking' ),
                'default'     => esc_html__( 'The customer will receive an email with order details and a payment link.', 'salesking' ),
                'desc_tip'    => true,
            ),

            'enable_for_methods' => array(
                'title'             => esc_html__( 'Enable for shipping methods', 'salesking' ),
                'type'              => 'multiselect',
                'class'             => 'wc-enhanced-select',
                'css'               => 'width: 400px;',
                'default'           => '',
                'description'       => esc_html__( 'If this is only available for certain methods, set it up here. Leave blank to enable for all methods.', 'salesking' ),
                'options'           => $shipping_methods,
                'desc_tip'          => true,
                'custom_attributes' => array(
                    'data-placeholder' => esc_html__( 'Select shipping methods', 'salesking' ),
                ),
            ),
            'enable_for_virtual' => array(
                'title'             => esc_html__( 'Accept for virtual orders', 'salesking' ),
                'label'             => esc_html__( 'Accept invoice if the order is virtual', 'salesking' ),
                'type'              => 'checkbox',
                'default'           => 'yes',
            ),
       );
    }

    function process_payment( $order_id ) {
      $order = wc_get_order( $order_id );

      if ( $order->get_total() > 0 ) {
          // Mark as processing or on-hold (payment won't be taken until delivery).
          $order->update_status( 'pending', esc_html__( 'Awaiting customer payment.', 'salesking' ) );
          // send pending email
          do_action( 'salesking_new_order_pending', $order_id, $order );
      } else {
          $order->payment_complete();
      }

      // Remove cart.
      WC()->cart->empty_cart();

      // Return thankyou redirect.
      return array(
          'result'   => 'success',
          'redirect' => $this->get_return_url( $order ),
      );

    }
}