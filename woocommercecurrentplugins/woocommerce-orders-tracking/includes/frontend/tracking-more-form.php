<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_TRACKING_MORE_FORM {
	public function __construct() {
		add_action( 'init', array( $this, 'init' ) );
	}

	public function init() {
		add_shortcode( 'vi_wot_tracking_more_form', array( $this, 'shortcode_init' ) );
	}

	public function shortcode_init( $atts ) {
		global $wot_tracking_more_form;
		if ( $wot_tracking_more_form !== null ) {
			return '';
		} else {
			extract( shortcode_atts( array(
				'lang'    => 'en',
				'express' => '',
			), $atts ) );
			wp_enqueue_script( 'vi-wot-tracking-more-form', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'tracking-more-form.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			wp_enqueue_style( 'vi-wot-tracking-more-form', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'tracking-more-form.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			$wot_tracking_more_form = true;
			ob_start();
			?>
            <div class="woo-orders-tracking-trackingmore-form-shortcode-container">
                <form role="form" action="//track.trackingmore.com/carriers" method="get">
                    <div class="TM_input-group">
                        <input type="text" class="TM_my_search_input_style" id="button_tracking_number"
                               placeholder="<?php echo esc_attr__( 'Tracking Number', 'woocommerce-orders-tracking' ) ?>"
                               name="button_tracking_number" value="" autocomplete="off"
                               maxlength="100">
                        <span class="TM_input-group-btn">
                            <button class="TM_my_search_button_style " id="query"
                                    type="button"><?php esc_html_e( 'Track', 'woocommerce-orders-tracking' ) ?></button>
                        </span>
                    </div>
                    <input type="hidden" name="lang" value="<?php echo esc_attr( $lang ); ?>"/>
                    <input id="button_express_code" type="hidden" name="lang" value="<?php echo esc_attr( $express ); ?>"/>
                </form>
                <div id="TRNum"></div>
            </div>
			<?php
			return ob_get_clean();
		}
	}
}