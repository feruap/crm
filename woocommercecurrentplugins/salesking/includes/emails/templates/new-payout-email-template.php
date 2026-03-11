<?php
	
defined( 'ABSPATH' ) || exit;

/*
 * @hooked WC_Emails::email_header() Output the email header
 */
do_action( 'woocommerce_email_header', $email_heading, $email );


// removes whitespaces and minuses from amount
$amount = str_replace(' ', '', $amount);
$amount = str_replace('-', '', $amount);
?>

<p>
	<?php esc_html_e( 'Your payout has been processed! Happy Spending!', 'salesking');	?>
	<br /><br />
	<?php esc_html_e( 'Amount: ','salesking'); echo wc_price($amount); ?>
	<br /><br />
 	<?php esc_html_e( 'Method: ','salesking'); echo esc_html($method); ?>
	<br /><br />
 	<?php esc_html_e( 'Notes: ','salesking'); echo esc_html($note); ?>

</p>
<?php

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
