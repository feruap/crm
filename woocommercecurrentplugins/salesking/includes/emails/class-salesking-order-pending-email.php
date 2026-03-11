<?php


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

if (!class_exists('Salesking_Order_Pending_Email')) {
	class Salesking_Order_Pending_Email extends WC_Email {


		public function __construct() {
			$this->id             = 'salesking_order_pending_email';
			$this->customer_email = true;

			$this->title   = esc_html__('Pending order', 'salesking' );
			$this->heading = esc_html__('Pending order', 'salesking');
			$this->subject = esc_html__('Pending order', 'salesking');
			$this->description    = esc_html__( 'This is an order notification sent to customers after a sales agent places the order.', 'salesking' );

			$this->template_base  = SALESKING_DIR . 'includes/emails/templates/';
			$this->template_html  = 'new-order-pending-email-template.php';
			$this->template_plain =  'plain-new-order-pending-email-template.php';

			$this->placeholders   = array(
				'{order_date}'   => '',
				'{order_number}' => '',
			);

			// Call parent constructor.
			parent::__construct();

			add_action( 'salesking_new_order_pending_notification', array( $this, 'trigger'), 10, 2 );
		}


		public function trigger( $order_id, $order = false ) {
			$this->setup_locale();

			if ( $order_id && ! is_a( $order, 'WC_Order' ) ) {
				$order = wc_get_order( $order_id );
			}

			$email_address = $this->get_recipient();

			$order_id = $order->get_order_number();


			do_action('wpml_switch_language_for_email', $email_address);
			$this->heading = esc_html__('Pending order', 'salesking').' #'.$order_id;
			$this->subject = esc_html__('Pending order', 'salesking').' #'.$order_id;
			

			if ( is_a( $order, 'WC_Order' ) ) {
				$this->object                         = $order;
				$this->recipient                      = $this->object->get_billing_email();
				$this->placeholders['{order_date}']   = wc_format_datetime( $this->object->get_date_created() );
				$this->placeholders['{order_number}'] = $this->object->get_order_number();
			}

			if ( $this->is_enabled() && $this->get_recipient() ) {
				$this->send( $this->get_recipient(), $this->get_subject(), $this->get_content(), $this->get_headers(), $this->get_attachments() );
			}

			$this->restore_locale();
			do_action('wpml_restore_language_from_email');

		}

		public function get_content_html() {
				ob_start();
			if (method_exists($this, 'get_additional_content')){
			    $additional_content_checked = $this->get_additional_content();
			} else {
			    $additional_content_checked = false;
			}
			wc_get_template( $this->template_html, array(
			    'order'              => $this->object,
				'email_heading'      => $this->get_heading(),
				'additional_content' => $this->get_additional_content(),
				'sent_to_admin'      => false,
				'plain_text'         => false,
				'email'              => $this,
			), $this->template_base, $this->template_base  );
			return ob_get_clean();
		}


		public function get_content_plain() {
	        ob_start();
	        if (method_exists($this, 'get_additional_content')){
	            $additional_content_checked = $this->get_additional_content();
	        } else {
	            $additional_content_checked = false;
	        }
	        wc_get_template( $this->template_plain, array(
	            'order'              => $this->object,
				'email_heading'      => $this->get_heading(),
				'additional_content' => $this->get_additional_content(),
				'sent_to_admin'      => false,
				'plain_text'         => true,
				'email'              => $this,
	        ), $this->template_base, $this->template_base );
	        return ob_get_clean();
		}

	}
}

return new Salesking_Order_Pending_Email();