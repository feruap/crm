<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
 * @hooked WC_Emails::email_header() Output the email header
 */
do_action( 'woocommerce_email_header', $email_heading, $email ); ?>

<?php /* translators: %s: Customer first name */ ?>
<p><?php printf( esc_html__( 'Hi %s,', 'salesking' ), esc_html( $order->get_billing_first_name() ) ); ?></p>
<?php /* translators: %s: Order number */ ?>
<p><?php printf( esc_html__( 'An agent has placed order #%s on your behalf. The order is now awaiting your payment. ', 'salesking' ), esc_html( $order->get_order_number() ) ); 
	printf(
		'<a href="%s">%s</a>',
		esc_url( $order->get_checkout_payment_url() ),
		esc_html__( 'Go to payment page &rarr;', 'salesking' )
	);


?></p>

<?php


if ( class_exists( 'WC_Payment_Gateways' ) ) {
	$gateways = WC_Payment_Gateways::instance(); // gateway instance
	$available_gateways = $gateways->get_available_payment_gateways();

	if ( isset( $available_gateways['cod'] ) ){
		remove_action ('woocommerce_email_before_order_table', array( $available_gateways['cod'], 'email_instructions' ), 10 ); 
	}

	if ( isset( $available_gateways['salesking-pending-gateway'] ) ){
		remove_action ('woocommerce_email_before_order_table', array( $available_gateways['salesking-pending-gateway'], 'email_instructions' ), 10 ); 
	}

}


do_action( 'woocommerce_email_order_details', $order, $sent_to_admin, $plain_text, $email );

/*
 * @hooked WC_Emails::order_meta() Shows order meta data.
 */
do_action( 'woocommerce_email_order_meta', $order, $sent_to_admin, $plain_text, $email );

/*
 * @hooked WC_Emails::customer_details() Shows customer details
 * @hooked WC_Emails::email_address() Shows email address
 */
do_action( 'woocommerce_email_customer_details', $order, $sent_to_admin, $plain_text, $email );

/**
 * Show user-defined additional content - this is set in each email's settings.
 */
if ( $additional_content ) {
	echo wp_kses_post( wpautop( wptexturize( $additional_content ) ) );
}

/*
 * @hooked WC_Emails::email_footer() Output the email footer
 */
do_action( 'woocommerce_email_footer', $email );