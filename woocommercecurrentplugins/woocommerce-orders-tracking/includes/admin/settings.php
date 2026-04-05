<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_SETTINGS {
	private $settings;
	private $schedule_send_emails;
	private $shipping_countries;
	protected $language;
	protected $languages;
	protected $default_language;
	protected $languages_data;

	public function __construct() {
		$this->settings         = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		$this->languages        = array();
		$this->languages_data   = array();
		$this->default_language = '';
		add_action( 'admin_menu', array( $this, 'admin_menu' ) );
		add_action( 'admin_init', array( $this, 'check_update' ) );
		add_action( 'admin_init', array( $this, 'save_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_script' ) );
		add_action( 'wp_ajax_wotv_admin_add_new_shipping_carrier', array(
			$this,
			'wotv_admin_add_new_shipping_carrier'
		) );
		add_action( 'wp_ajax_wotv_admin_edit_shipping_carrier', array( $this, 'wotv_admin_edit_shipping_carrier' ) );
		add_action( 'wp_ajax_wotv_admin_delete_shipping_carrier', array(
			$this,
			'wotv_admin_delete_shipping_carrier'
		) );
		add_action( 'wp_ajax_wotv_admin_get_tracking_service_carriers', array(
			$this,
			'get_tracking_service_carriers'
		) );
		add_action( 'media_buttons', array( $this, 'preview_emails_button' ) );
		add_action( 'wp_ajax_wot_preview_emails', array( $this, 'wot_preview_emails' ) );
		add_action( 'wp_ajax_wot_test_connection_paypal', array( $this, 'wot_test_connection_paypal' ) );
		add_action( 'wp_ajax_woo_orders_tracking_search_page', array( $this, 'search_page' ) );
		add_action( 'wp_ajax_woo_orders_tracking_send_test_sms', array( $this, 'send_test_sms' ) );
	}

	public function get_tracking_service_carriers() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		if ( ! isset( $_GET['action_nonce'] ) || ! wp_verify_nonce( $_GET['action_nonce'], 'vi_wot_setting_action_nonce' ) ) {
			return;
		}
		wp_send_json(
			array(
				'status'                => 'success',
				'trackingmore_carriers' => VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::carriers( true ),
				'17track_carriers'      => VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::carriers( true ),
				'tracktry_carriers'     => VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKTRY::carriers( true ),
			)
		);
	}

	public static function set( $name, $set_name = false ) {
		return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
	}

	public function send_test_sms() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		if ( ! isset( $_POST['action_nonce'] ) || ! wp_verify_nonce( $_POST['action_nonce'], 'vi_wot_setting_action_nonce' ) ) {
			return;
		}
		$text               = isset( $_POST['text'] ) ? sanitize_text_field( $_POST['text'] ) : '';
		$provider           = isset( $_POST['provider'] ) ? sanitize_text_field( $_POST['provider'] ) : '';
		$from_number        = isset( $_POST['from_number'] ) ? sanitize_text_field( $_POST['from_number'] ) : '';
		$app_id             = isset( $_POST['app_id'] ) ? sanitize_text_field( $_POST['app_id'] ) : '';
		$app_token          = isset( $_POST['app_token'] ) ? sanitize_text_field( $_POST['app_token'] ) : '';
		$powerpack          = isset( $_POST['powerpack'] ) ? sanitize_text_field( $_POST['powerpack'] ) : '';
		$bitly_access_token = isset( $_POST['bitly_access_token'] ) ? sanitize_text_field( $_POST['bitly_access_token'] ) : '';
		$send_test_sms      = isset( $_POST['send_test_sms'] ) ? sanitize_text_field( $_POST['send_test_sms'] ) : '';
		$response           = array(
			'status'        => 'success',
			'message'       => '',
			'message_title' => '',
		);
		if ( $text ) {
			$shortlink = get_permalink( $this->settings->get_params( 'service_tracking_page' ) );
			if ( ! $shortlink ) {
				$shortlink = get_site_url();
			}
			if ( $bitly_access_token ) {
				$bitly             = new VI_WOOCOMMERCE_ORDERS_TRACKING_BITLY( $bitly_access_token );
				$shortlink_request = $bitly->get_link( $shortlink );
				if ( $shortlink_request['status'] === 'success' ) {
					$shortlink = $shortlink_request['data']['link'];
				}
			}
			$user = wp_get_current_user();
			$text = str_replace( array(
				'{tracking_number}',
				'{tracking_url}',
				'{carrier_name}',
				'{carrier_url}',
				'{order_id}',
				'{order_number}',
				'{billing_first_name}',
				'{billing_last_name}'
			), array(
				'Test_tracking_number',
				$shortlink,
				'UPS',
				'https://wwwapps.ups.com/WebTracking/track?track=yes&trackNums=',
				'12345',
				'order #12345',
				empty( $user->display_name ) ? 'John' : $user->display_name,
				empty( $user->display_name ) ? 'John' : $user->display_name
			), $text );
			switch ( $provider ) {
				case 'twilio':
					$sms_object             = new VI_WOOCOMMERCE_ORDERS_TRACKING_TWILIO( $app_id, $app_token );
					$sms_response           = $sms_object->send( $from_number, $send_test_sms, $text );
					$response['sms_status'] = $sms_response['status'];
					if ( $sms_response['status'] === 'error' ) {
						$response['message']       = $sms_response['data'];
						$response['message_title'] = esc_html__( 'Failed sending SMS message', 'woocommerce-orders-tracking' );
					} elseif ( in_array( $sms_response['data']['status'], array( 'failed', 'undelivered' ) ) ) {
						$response['sms_status']    = 'error';
						$response['message']       = isset( $sms_response['data']['error_message'] ) ? $sms_response['data']['error_message'] : '';
						$response['message_title'] = esc_html__( 'Failed sending SMS message', 'woocommerce-orders-tracking' );
					} else {
						$response['message_title'] = esc_html__( 'Send SMS message successfully', 'woocommerce-orders-tracking' );
						$response['message']       = empty( $sms_response['body'] ) ? $text : $sms_response['body'];
					}
					break;
				case 'nexmo':
					$sms_object             = new VI_WOOCOMMERCE_ORDERS_TRACKING_NEXMO( $app_id, $app_token );
					$sms_response           = $sms_object->send( $from_number, $send_test_sms, $text );
					$response['sms_status'] = $sms_response['status'];
					if ( $sms_response['status'] === 'error' ) {
						$response['message_title'] = esc_html__( 'Failed sending SMS message', 'woocommerce-orders-tracking' );
						$response['message']       = $sms_response['data'];
					} else {
						$response['message_title'] = esc_html__( 'Send SMS message successfully', 'woocommerce-orders-tracking' );
						$response['message']       = $text;
					}
					break;
				case 'plivo':
					$sms_object             = new VI_WOOCOMMERCE_ORDERS_TRACKING_PLIVO( $app_id, $app_token );
					$sms_response           = $sms_object->send( $powerpack, $send_test_sms, $text );
					$response['sms_status'] = $sms_response['status'];
					if ( $sms_response['status'] === 'error' ) {
						$response['message_title'] = esc_html__( 'Failed sending SMS message', 'woocommerce-orders-tracking' );
						$response['message']       = $sms_response['data'];
					} else {
						$response['message_title'] = esc_html__( 'Send SMS message successfully', 'woocommerce-orders-tracking' );
						$response['message']       = $text;
					}
					break;
				default:

			}
		} else {
			$response['status']  = 'error';
			$response['message'] = esc_html__( 'Empty message', 'woocommerce-orders-tracking' );
		}
		wp_send_json( $response );
	}

	public function check_update() {
		if ( class_exists( 'VillaTheme_Plugin_Check_Update' ) ) {
			$setting_url = admin_url( 'admin.php?page=woocommerce-orders-tracking' );
			$key         = $this->settings->get_params( 'key' );
			new VillaTheme_Plugin_Check_Update (
				VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION,                    // current version
				'https://villatheme.com/wp-json/downloads/v3',  // update path
				'woocommerce-orders-tracking/woocommerce-orders-tracking.php',                  // plugin file slug
				'woocommerce-orders-tracking', '25799', $key, $setting_url
			);
			new VillaTheme_Plugin_Updater( 'woocommerce-orders-tracking/woocommerce-orders-tracking.php', 'woocommerce-orders-tracking', $setting_url );
		}
	}

	public function admin_menu() {
		add_menu_page(
			esc_html__( 'WooCommerce Orders Tracking settings', 'woocommerce-orders-tracking' ),
			esc_html__( 'Orders Tracking', 'woocommerce-orders-tracking' ),
			VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ),
			'woocommerce-orders-tracking',
			array( $this, 'settings_callback' ),
			'dashicons-location',
			'2'
		);
	}

	/**
	 *
	 */
	public function save_settings() {
		global $pagenow;
		global $woo_orders_tracking_settings;
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		$page = isset( $_REQUEST['page'] ) ? sanitize_text_field( $_REQUEST['page'] ) : '';
		if ( $pagenow === 'admin.php' && $page === 'woocommerce-orders-tracking' ) {
			/*wpml*/
			if ( is_plugin_active( 'sitepress-multilingual-cms/sitepress.php' ) ) {
				global $sitepress;
				$default_lang           = $sitepress->get_default_language();
				$this->default_language = $default_lang;
				$languages              = apply_filters( 'wpml_active_languages', null, null );
				$this->languages_data   = $languages;
				if ( count( $languages ) ) {
					foreach ( $languages as $key => $language ) {
						if ( $key != $default_lang ) {
							$this->languages[] = $key;
						}
					}
				}
			} elseif ( class_exists( 'Polylang' ) ) {
				/*Polylang*/
				$languages    = pll_languages_list();
				$default_lang = pll_default_language( 'slug' );
				foreach ( $languages as $language ) {
					if ( $language == $default_lang ) {
						continue;
					}
					$this->languages[] = $language;
				}
			}
			if ( isset( $_POST['_vi_wot_setting_nonce'] ) && wp_verify_nonce( $_POST['_vi_wot_setting_nonce'], 'vi_wot_setting_action_nonce' ) ) {
				$args                                             = $this->settings->get_params();
				$save_carrier_name_in_post_meta_old               = $args['save_carrier_name_in_post_meta'];
				$args['manage_tracking']                          = isset( $_POST['woo-orders-tracking-settings']['manage_tracking'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['manage_tracking'] ) : '';
				$args['track_per_quantity']                       = isset( $_POST['woo-orders-tracking-settings']['track_per_quantity'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['track_per_quantity'] ) : '';
				$args['edit_single_tracking_old_ui']              = isset( $_POST['woo-orders-tracking-settings']['edit_single_tracking_old_ui'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['edit_single_tracking_old_ui'] ) : '';
				$args['active_carriers']                          = isset( $_POST['woo-orders-tracking-settings']['active_carriers'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['active_carriers'] ) : array();
				$args['service_carrier_enable']                   = isset( $_POST['woo-orders-tracking-settings']['service_carrier']['service_carrier_enable'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['service_carrier']['service_carrier_enable'] ) : '';
				$args['service_carrier_type']                     = isset( $_POST['woo-orders-tracking-settings']['service_carrier']['service_carrier_type'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['service_carrier']['service_carrier_type'] ) : '';
				$args['timeline_ajax']                            = isset( $_POST['woo-orders-tracking-settings']['service_carrier']['timeline_ajax'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['service_carrier']['timeline_ajax'] ) : '';
				$args['service_tracking_page']                    = isset( $_POST['woo-orders-tracking-settings']['service_carrier']['service_tracking_page'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['service_carrier']['service_tracking_page'] ) : '';
				$args['service_cache_request']                    = isset( $_POST['woo-orders-tracking-settings']['service_carrier']['service_cache_request'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['service_carrier']['service_cache_request'] ) : '';
				$args['service_carrier_api_key']                  = isset( $_POST['woo-orders-tracking-settings']['service_carrier']['service_carrier_api_key'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['service_carrier']['service_carrier_api_key'] ) : '';
				$args['service_add_tracking_if_not_exist']        = isset( $_POST['woo-orders-tracking-settings']['service_carrier']['service_add_tracking_if_not_exist'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['service_carrier']['service_add_tracking_if_not_exist'] ) : '';
				$args['email_woo_enable']                         = isset( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_enable'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_enable'] ) : '';
				$args['email_woo_status']                         = isset( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_status'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_status'] ) : array();
				$args['email_woo_position']                       = isset( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_position'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_position'] ) : 'after_order_table';
				$args['email_woo_html']                           = isset( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_html'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_html'] ) : '';
				$args['email_woo_tracking_list_html']             = isset( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_tracking_list_html'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_tracking_list_html'] ) : '';
				$args['email_woo_tracking_number_html']           = isset( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_tracking_number_html'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_tracking_number_html'] ) : '';
				$args['email_woo_tracking_carrier_html']          = isset( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_tracking_carrier_html'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo']['email_woo_tracking_carrier_html'] ) : '';
				$args['email_send_all_order_items']               = isset( $_POST['woo-orders-tracking-settings']['email']['email_send_all_order_items'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_send_all_order_items'] ) : '';
				$args['email_cc']                                 = isset( $_POST['woo-orders-tracking-settings']['email']['email_cc'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_cc'] ) : '';
				$args['email_bcc']                                = isset( $_POST['woo-orders-tracking-settings']['email']['email_bcc'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_bcc'] ) : '';
				$args['email_send_after_aliexpress_order_synced'] = isset( $_POST['woo-orders-tracking-settings']['email']['email_send_after_aliexpress_order_synced'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_send_after_aliexpress_order_synced'] ) : '';
				$args['email_column_tracking_number']             = isset( $_POST['woo-orders-tracking-settings']['email']['email_column_tracking_number'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email']['email_column_tracking_number'] ) : '';
				$args['email_column_carrier_name']                = isset( $_POST['woo-orders-tracking-settings']['email']['email_column_carrier_name'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email']['email_column_carrier_name'] ) : '';
				$args['email_column_tracking_url']                = isset( $_POST['woo-orders-tracking-settings']['email']['email_column_tracking_url'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email']['email_column_tracking_url'] ) : '';
				$args['email_time_send']                          = isset( $_POST['woo-orders-tracking-settings']['email']['email_time_send'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_time_send'] ) : '';
				$args['email_time_send_type']                     = isset( $_POST['woo-orders-tracking-settings']['email']['email_time_send_type'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_time_send_type'] ) : '';
				$args['email_number_send']                        = isset( $_POST['woo-orders-tracking-settings']['email']['email_number_send'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_number_send'] ) : '';
				$args['email_subject']                            = isset( $_POST['woo-orders-tracking-settings']['email']['email_subject'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_subject'] ) : '';
				$args['email_template']                           = isset( $_POST['woo-orders-tracking-settings']['email_template'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email_template'] ) : '';
				$args['email_heading']                            = isset( $_POST['woo-orders-tracking-settings']['email']['email_heading'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['email']['email_heading'] ) : '';
				$args['email_content']                            = isset( $_POST['woo-orders-tracking-settings']['email']['email_content'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email']['email_content'] ) : '';
				$args['paypal_sandbox_enable']                    = isset( $_POST['woo-orders-tracking-settings']['paypal']['paypal_sandbox_enable'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['paypal']['paypal_sandbox_enable'] ) : array();
				$args['paypal_method']                            = isset( $_POST['woo-orders-tracking-settings']['paypal']['paypal_method'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['paypal']['paypal_method'] ) : array();
				$args['paypal_client_id_live']                    = isset( $_POST['woo-orders-tracking-settings']['paypal']['paypal_client_id_live'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['paypal']['paypal_client_id_live'] ) : array();
				$args['paypal_client_id_sandbox']                 = isset( $_POST['woo-orders-tracking-settings']['paypal']['paypal_client_id_sandbox'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['paypal']['paypal_client_id_sandbox'] ) : array();
				$args['paypal_secret_live']                       = isset( $_POST['woo-orders-tracking-settings']['paypal']['paypal_secret_live'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['paypal']['paypal_secret_live'] ) : array();
				$args['paypal_secret_sandbox']                    = isset( $_POST['woo-orders-tracking-settings']['paypal']['paypal_secret_sandbox'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['paypal']['paypal_secret_sandbox'] ) : array();
				$args['paypal_add_after_aliexpress_order_synced'] = isset( $_POST['woo-orders-tracking-settings']['paypal']['paypal_add_after_aliexpress_order_synced'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['paypal']['paypal_add_after_aliexpress_order_synced'] ) : '';
				$args['paypal_debug']                             = isset( $_POST['woo-orders-tracking-settings']['paypal']['paypal_debug'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['paypal']['paypal_debug'] ) : '';
				$args['sms_from_number']                          = isset( $_POST['woo-orders-tracking-settings']['sms_from_number'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_from_number'] ) : '';
				$args['sms_text']                                 = isset( $_POST['woo-orders-tracking-settings']['sms_text'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_text'] ) : '';
				$args['sms_text_new']                             = isset( $_POST['woo-orders-tracking-settings']['sms_text_new'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_text_new'] ) : '';
				$args['sms_provider']                             = isset( $_POST['woo-orders-tracking-settings']['sms_provider'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_provider'] ) : '';
				$args['sms_twilio_app_id']                        = isset( $_POST['woo-orders-tracking-settings']['sms_twilio_app_id'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_twilio_app_id'] ) : '';
				$args['sms_twilio_app_token']                     = isset( $_POST['woo-orders-tracking-settings']['sms_twilio_app_token'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_twilio_app_token'] ) : '';
				$args['sms_nexmo_app_id']                         = isset( $_POST['woo-orders-tracking-settings']['sms_nexmo_app_id'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_nexmo_app_id'] ) : '';
				$args['sms_nexmo_app_token']                      = isset( $_POST['woo-orders-tracking-settings']['sms_nexmo_app_token'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_nexmo_app_token'] ) : '';
				$args['sms_nexmo_unicode']                        = isset( $_POST['woo-orders-tracking-settings']['sms_nexmo_unicode'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_nexmo_unicode'] ) : '';
				$args['sms_plivo_app_id']                         = isset( $_POST['woo-orders-tracking-settings']['sms_plivo_app_id'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_plivo_app_id'] ) : '';
				$args['sms_plivo_app_token']                      = isset( $_POST['woo-orders-tracking-settings']['sms_plivo_app_token'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_plivo_app_token'] ) : '';
				$args['sms_plivo_powerpack_uuid']                 = isset( $_POST['woo-orders-tracking-settings']['sms_plivo_powerpack_uuid'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_plivo_powerpack_uuid'] ) : '';
				$args['bitly_access_token']                       = isset( $_POST['woo-orders-tracking-settings']['bitly_access_token'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['bitly_access_token'] ) : '';
				$args['send_test_sms']                            = isset( $_POST['woo-orders-tracking-settings']['send_test_sms'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['send_test_sms'] ) : '';
				$args['sms_send_after_aliexpress_order_synced']   = isset( $_POST['woo-orders-tracking-settings']['sms_send_after_aliexpress_order_synced'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['sms_send_after_aliexpress_order_synced'] ) : '';

				$args['tracking_form_recaptcha_enable']     = isset( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_enable'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_enable'] ) : '';
				$args['tracking_form_recaptcha_version']    = isset( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_version'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_version'] ) : '';
				$args['tracking_form_recaptcha_site_key']   = isset( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_site_key'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_site_key'] ) : '';
				$args['tracking_form_recaptcha_secret_key'] = isset( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_secret_key'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_secret_key'] ) : '';
				$args['tracking_form_recaptcha_theme']      = isset( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_theme'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['tracking_form_recaptcha_theme'] ) : '';
				$args['change_order_status']                = isset( $_POST['woo_orders_tracking_change_order_status'] )
					? self::stripslashes_deep( $_POST['woo_orders_tracking_change_order_status'] ) : '';
				$args['change_order_exclude_status']        = isset( $_POST['woo_orders_tracking_change_order_exclude_status'] )
					? self::stripslashes_deep( $_POST['woo_orders_tracking_change_order_exclude_status'] ) : array();
				$args['default_track_info_enable']          = isset( $_POST['woo-orders-tracking-settings']['default_track_info_enable'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['default_track_info_enable'] ) : '';
				$args['default_track_info_number']          = isset( $_POST['woo-orders-tracking-settings']['default_track_info_number'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['default_track_info_number'] ) : '';
				$args['default_track_info_carrier']         = isset( $_POST['woo-orders-tracking-settings']['default_track_info_carrier'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['default_track_info_carrier'] ) : '';
				$args['default_track_info_position']        = isset( $_POST['woo-orders-tracking-settings']['default_track_info_position'] )
					? self::stripslashes( $_POST['woo-orders-tracking-settings']['default_track_info_position'] ) : '';
				$args['default_track_info_content']         = isset( $_POST['woo-orders-tracking-settings']['default_track_info_content'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['default_track_info_content'] ) : '';
				$args['translate_timeline']                 = isset( $_POST['woo-orders-tracking-settings']['translate_timeline'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['translate_timeline'] ) : '';
				$args['cloud_translation_api']              = isset( $_POST['woo-orders-tracking-settings']['cloud_translation_api'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['cloud_translation_api'] ) : '';
				$args['save_carrier_name_in_post_meta']     = isset( $_POST['woo-orders-tracking-settings']['save_carrier_name_in_post_meta'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['save_carrier_name_in_post_meta'] ) : '';
				if ( count( $this->languages ) ) {
					foreach ( $this->languages as $key => $value ) {
						$args[ 'email_template_' . $value ]                  = isset( $_POST['woo-orders-tracking-settings'][ 'email_template_' . $value ] )
							? self::stripslashes( $_POST['woo-orders-tracking-settings'][ 'email_template_' . $value ] ) : '';
						$args[ 'email_subject_' . $value ]                   = isset( $_POST['woo-orders-tracking-settings']['email'][ 'email_subject_' . $value ] )
							? self::stripslashes( $_POST['woo-orders-tracking-settings']['email'][ 'email_subject_' . $value ] ) : '';
						$args[ 'email_heading_' . $value ]                   = isset( $_POST['woo-orders-tracking-settings']['email'][ 'email_heading_' . $value ] )
							? self::stripslashes( $_POST['woo-orders-tracking-settings']['email'][ 'email_heading_' . $value ] ) : '';
						$args[ 'email_content_' . $value ]                   = isset( $_POST['woo-orders-tracking-settings']['email'][ 'email_content_' . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email'][ 'email_content_' . $value ] ) : '';
						$args[ 'email_column_tracking_number_' . $value ]    = isset( $_POST['woo-orders-tracking-settings']['email'][ 'email_column_tracking_number_' . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email'][ 'email_column_tracking_number_' . $value ] ) : '';
						$args[ 'email_column_carrier_name_' . $value ]       = isset( $_POST['woo-orders-tracking-settings']['email'][ 'email_column_carrier_name_' . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email'][ 'email_column_carrier_name_' . $value ] ) : '';
						$args[ 'email_column_tracking_url_' . $value ]       = isset( $_POST['woo-orders-tracking-settings']['email'][ 'email_column_tracking_url_' . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email'][ 'email_column_tracking_url_' . $value ] ) : '';
						$args[ 'sms_from_number_' . $value ]                 = isset( $_POST['woo-orders-tracking-settings'][ 'sms_from_number_' . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings'][ 'sms_from_number_' . $value ] ) : '';
						$args[ 'sms_text_' . $value ]                        = isset( $_POST['woo-orders-tracking-settings'][ 'sms_text_' . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings'][ 'sms_text_' . $value ] ) : '';
						$args[ 'sms_text_new_' . $value ]                    = isset( $_POST['woo-orders-tracking-settings'][ 'sms_text_new_' . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings'][ 'sms_text_new_' . $value ] ) : '';
						$args[ 'email_woo_html_' . $value ]                  = isset( $_POST['woo-orders-tracking-settings']['email_woo'][ 'email_woo_html_' . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo'][ 'email_woo_html_' . $value ] ) : '';
						$args[ 'email_woo_tracking_list_html_' . $value ]    = isset( $_POST['woo-orders-tracking-settings']['email_woo'][ 'email_woo_tracking_list_html_'
						                                                                                                                   . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo'][ 'email_woo_tracking_list_html_' . $value ] ) : '';
						$args[ 'email_woo_tracking_number_html_' . $value ]  = isset( $_POST['woo-orders-tracking-settings']['email_woo'][ 'email_woo_tracking_number_html_'
						                                                                                                                   . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo'][ 'email_woo_tracking_number_html_' . $value ] ) : '';
						$args[ 'email_woo_tracking_carrier_html_' . $value ] = isset( $_POST['woo-orders-tracking-settings']['email_woo'][ 'email_woo_tracking_carrier_html_'
						                                                                                                                   . $value ] )
							? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['email_woo'][ 'email_woo_tracking_carrier_html_' . $value ] ) : '';
					}
				}
				/*Only administrator can change advanced settings and auto update key*/
				if ( current_user_can( 'manage_options' ) ) {
					foreach ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_functionality() as $gf_key => $gf_value ) {
						$args['capabilities'][ $gf_key ] = isset( $_POST['woo-orders-tracking-settings']['capabilities'][ $gf_key ] )
							? self::stripslashes( $_POST['woo-orders-tracking-settings']['capabilities'][ $gf_key ] ) : '';
					}
					$args['key'] = isset( $_POST['woo-orders-tracking-settings']['key'] ) ? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['key'] ) : '';
				}
				/*Adjust active carriers and default carrier*/
				if ( count( $args['active_carriers'] ) ) {
					$args['shipping_carrier_default'] = $args['active_carriers'][0];
				} elseif ( $args['shipping_carrier_default'] ) {
					$args['active_carriers'] = array( $args['shipping_carrier_default'] );
				}
				/*Save default tracking info*/
				$ft_messages     = isset( $_POST['woo-orders-tracking-settings']['default_track_info_message'] )
					? self::stripslashes_deep( $_POST['woo-orders-tracking-settings']['default_track_info_message'] ) : array();
				$default_message = array();
				if ( count( $ft_messages ) ) {
					foreach ( $ft_messages['description'] as $ft_message_key => $description ) {
						$default_message[] = array(
							'time'           => DAY_IN_SECONDS * absint( $ft_messages['day'][ $ft_message_key ] ) + HOUR_IN_SECONDS
							                                                                                        * absint( $ft_messages['hour'][ $ft_message_key ] )
							                    + MINUTE_IN_SECONDS * absint( $ft_messages['minute'][ $ft_message_key ] ),
							'description'    => $description,
							'location'       => '',
							'status'         => $ft_messages['status'][ $ft_message_key ],
							'order_statuses' => $ft_messages['order_statuses'][ $ft_message_key ] ? vi_wot_json_decode( $ft_messages['order_statuses'][ $ft_message_key ] )
								: array(),
						);
					}
					uasort( $default_message, array( __CLASS__, 'sort_by_time' ) );
				}
				$args['default_track_info_message'] = $default_message;
				$args                               = apply_filters( 'woo_orders_tracking_update_settings_args', $args );
				/*Update settings*/
				update_option( 'woo_orders_tracking_settings', $args );
				$woo_orders_tracking_settings = $args;
				$this->settings               = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance( true );
				/*Update carrier name for existing orders when save_carrier_name_in_post_meta is switched from off to on*/
				if ( ! $save_carrier_name_in_post_meta_old && $args['save_carrier_name_in_post_meta'] ) {
					$args      = array(
						'posts_per_page' => - 1,
						'return'         => 'ids',
						'meta_query'     => array(// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
							'relation' => 'AND',
							array(
								'key'     => '_wot_tracking_carrier',
								'compare' => 'EXISTS',
							),
							array(
								'key'     => '_wot_tracking_carrier_name',
								'compare' => 'NOT EXISTS',
							),
						),
					);
					$order_ids = wc_get_orders( $args );
					foreach ( $order_ids as $order_id ) {
						$order                 = wc_get_order( $order_id );
						$_wot_tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
						if ( $_wot_tracking_carrier ) {
							$carrier = $this->settings->get_shipping_carrier_by_slug( $_wot_tracking_carrier );
							if ( $carrier ) {
								$display_name = $carrier['name'];
								if ( ! empty( $carrier['display_name'] ) ) {
									$display_name = $carrier['display_name'];
								}
								$order->update_meta_data( '_wot_tracking_carrier_name', $display_name );
								$order->save_meta_data();
							}
						}
					}
				}
				/*Save & Check key button*/
				if ( isset( $_POST['woo_orders_tracking_check_key'] ) ) {
					delete_site_transient( 'update_plugins' );
					delete_transient( 'villatheme_item_25799' );
					delete_option( 'woocommerce-orders-tracking_messages' );
					do_action( 'villatheme_save_and_check_key_woocommerce-orders-tracking', $args['key'] );
				}
			}
		}
	}

	public static function sort_by_time( $array1, $array2 ) {
		return $array1['time'] - $array2['time'];
	}

	private static function stripslashes( $value ) {
		return sanitize_text_field( stripslashes( $value ) );
	}

	private static function stripslashes_deep( $value ) {
		if ( is_array( $value ) ) {
			$value = array_map( 'stripslashes_deep', $value );
		} else {
			$value = wp_kses_post( stripslashes( $value ) );
		}

		return $value;
	}


	public function settings_callback() {
		?>
        <div class="wrap">
            <h2><?php esc_html_e( 'WooCommerce Orders Tracking settings', 'woocommerce-orders-tracking' ); ?></h2>
			<?php do_action( 'viwot_notices' ); ?>
            <div class="vi-ui raised">
                <form action="" class="vi-ui form" method="post">
					<?php
					wp_nonce_field( 'vi_wot_setting_action_nonce', '_vi_wot_setting_nonce' );
					$tabs = apply_filters( 'vi_wot_tab_menu', array(
						'shipping_carriers' => esc_html__( 'Shipping Carriers', 'woocommerce-orders-tracking' ),
						'email'             => esc_html__( 'Email', 'woocommerce-orders-tracking' ),
						'email_woo'         => esc_html__( 'WooCommerce Email', 'woocommerce-orders-tracking' ),
						'sms'               => esc_html__( 'SMS', 'woocommerce-orders-tracking' ),
						'paypal'            => esc_html__( 'PayPal', 'woocommerce-orders-tracking' ),
						'tracking_service'  => esc_html__( 'Tracking Service', 'woocommerce-orders-tracking' ),
						'integration'       => esc_html__( 'Integration', 'woocommerce-orders-tracking' ),
					) );
					if ( class_exists( 'VI_WOOCOMMERCE_ALIDROPSHIP' ) && version_compare( VI_WOOCOMMERCE_ALIDROPSHIP_VERSION, '1.0.0.6', '>=' ) ) {
						$tabs['ald'] = esc_html__( 'ALD dropshipping', 'woocommerce-orders-tracking' );
					}
					if ( current_user_can( 'manage_options' ) ) {
						$tabs['advanced'] = esc_html__( 'Advanced Settings', 'woocommerce-orders-tracking' );
						$tabs['update']   = esc_html__( 'Update', 'woocommerce-orders-tracking' );
					}
					?>
                    <div class="vi-ui vi-ui-main top tabular attached menu ">
                        <a class="item active" data-tab="general">
							<?php esc_html_e( 'General', 'woocommerce-orders-tracking' ) ?>
                        </a>
						<?php
						foreach ( $tabs as $k => $v ) {
							printf( '<a class="item" data-tab="%s">%s</a>', esc_attr( $k ), esc_html( $v ) );
						}
						?>
                    </div>
                    <div class="vi-ui bottom attached tab segment active" data-tab="general">
                        <table class="form-table">
                            <tbody>
                            <tr>
                                <th>
                                    <label for="<?php echo esc_attr( self::set( 'manage_tracking' ) ) ?>"><?php esc_html_e( 'Manage tracking by',
											'woocommerce-orders-tracking' ) ?></label>
                                </th>
                                <td>
									<?php
									$manage_tracking = $this->settings->get_params( 'manage_tracking' );
									?>
                                    <select name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[manage_tracking]"
                                            id="<?php echo esc_attr( self::set( 'manage-tracking' ) ) ?>"
                                            class="vi-ui fluid dropdown <?php echo esc_attr( self::set( 'manage-tracking' ) ) ?>">
										<?php
										foreach (
											array(
												'order_only' => esc_html__( 'Order only - Each order can only have 1 tracking number at a time', 'woocommerce-orders-tracking' ),
												'items_only' => esc_html__( 'Order items only - Each order item has its own tracking number', 'woocommerce-orders-tracking' ),
												'mixed'      => esc_html__( 'Both order and order items', 'woocommerce-orders-tracking' ),
											) as $key => $value
										) {
											?>
                                            <option value="<?php echo esc_attr( $key ) ?>" <?php selected( $manage_tracking, $key ) ?>><?php echo esc_html( $value ); ?></option>
											<?php
										}
										?>
                                    </select>
                                    <p class="description"><?php esc_html_e( 'Before, you had to set tracking number for every item of an order even if the order uses only one tracking number for all of its items.',
											'woocommerce-orders-tracking' ) ?></p>
                                    <p class="description"><?php esc_html_e( 'Now, if your tracking system works that way, you can choose to manage tracking by "Order only".',
											'woocommerce-orders-tracking' ) ?></p>
                                    <p class="description"><?php esc_html_e( 'Orders whose items already have tracking number(s) will not be affected by this feature.',
											'woocommerce-orders-tracking' ) ?></p>
                                    <p class="description">
                                        <strong><?php esc_html_e( '*Important', 'woocommerce-orders-tracking' ) ?>
                                            : </strong><?php esc_html_e( 'If you do AliExpress dropshipping, please DO NOT choose "Order only" as each item of an AliExpress order can have its own tracking number. If our dropshipping plugin(ALD) is active, it will override this feature to make tracking number field available for every item of an order.',
											'woocommerce-orders-tracking' ) ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th>
                                    <label for="<?php echo esc_attr( self::set( 'track_per_quantity' ) ) ?>"><?php esc_html_e( 'Multi track per item',
											'woocommerce-orders-tracking' ) ?></label>
                                </th>
                                <td>
                                    <select name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[track_per_quantity]"
                                            class="vi-ui fluid dropdown"
                                            id="<?php echo esc_attr( self::set( 'track_per_quantity' ) ) ?>">
										<?php
										$track_per_quantity      = $this->settings->get_params( 'track_per_quantity' );
										$track_per_quantity_args = array(
											''          => esc_html__( 'None', 'woocommerce-orders-tracking' ),
											'1'         => esc_html__( 'Track per item quantity', 'woocommerce-orders-tracking' ),
											'unlimited' => esc_html__( 'Unlimited', 'woocommerce-orders-tracking' ),
										);
										foreach ( $track_per_quantity_args as $k => $v ) {
											printf( '<option value="%s" %s>%s</option>', esc_attr( $k ), selected( $track_per_quantity, $k ), esc_html( $v ) );
										}
										?>
                                    </select>
                                    <p class="description <?php echo esc_attr( self::set( 'track_per_quantity-enable' ) ) ?>">
										<?php esc_html_e( 'If enabled, there will a tracking number field for each purchased quantity of an order item. "Manage tracking by" must NOT be set to "Order only"',
											'woocommerce-orders-tracking' ) ?></p>
                                    <p class="description <?php echo esc_attr( self::set( 'multi_track_per_item-enable' ) ) ?>">
										<?php esc_html_e( 'If enabled, You can add multiple tracking number fields for each purchased order item. "Manage tracking by" must NOT be set to "Order only". Please go to the order detail page to add multiple tracking for each item.',
											'woocommerce-orders-tracking' ) ?></p>
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="vi-ui bottom attached tab segment" data-tab="shipping_carriers">
						<?php
						$this->shipping_carriers_settings();
						?>
                    </div>
                    <div class="vi-ui bottom attached tab segment" data-tab="email">
						<?php
						$this->email_settings();
						?>
                    </div>
                    <div class="vi-ui bottom attached tab segment" data-tab="email_woo">
						<?php
						$this->email_woo_settings();
						?>
                    </div>
                    <div class="vi-ui bottom attached tab segment" data-tab="sms">
						<?php
						$this->sms_settings();
						?>
                    </div>
                    <div class="vi-ui bottom attached tab segment" data-tab="paypal">
						<?php
						$this->paypal_settings();
						?>
                    </div>
                    <div class="vi-ui bottom attached tab segment" data-tab="tracking_service">
						<?php
						$this->tracking_service_settings();
						?>
                    </div>
					<?php
					if ( current_user_can( 'manage_options' ) ) {
						?>
                        <div class="vi-ui bottom attached tab segment" data-tab="advanced">
							<?php
							$this->advanced_settings();
							?>
                        </div>
						<?php
					}
					if ( class_exists( 'VI_WOOCOMMERCE_ALIDROPSHIP' ) && version_compare( VI_WOOCOMMERCE_ALIDROPSHIP_VERSION, '1.0.0.6', '>=' ) ) {
						?>
                        <div class="vi-ui bottom attached tab segment" data-tab="ald">
                            <div class="vi-ui small positive message">
                                <div><?php esc_html_e( 'Compatibility with our ALD - Aliexpress Dropshipping and Fulfillment for WooCommerce plugin',
										'woocommerce-orders-tracking' ) ?></div>
                            </div>
                            <table class="form-table">
                                <tbody>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'email_send_after_aliexpress_order_synced' ) ) ?>"><?php esc_html_e( 'Send email',
												'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui toggle checkbox">
                                            <input type="checkbox"
                                                   name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_send_after_aliexpress_order_synced]"
                                                   id="<?php echo esc_attr( self::set( 'email_send_after_aliexpress_order_synced' ) ) ?>"
                                                   value="1" <?php checked( $this->settings->get_params( 'email_send_after_aliexpress_order_synced' ), '1' ) ?>><label></label>
                                        </div>
                                        <p class="description"><?php esc_html_e( 'When syncing AliExpress orders(by ALD plugin), send tracking info email to customers if tracking number updated or tracking status switches to delivered',
												'woocommerce-orders-tracking' ) ?></p>
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'sms_send_after_aliexpress_order_synced' ) ) ?>"><?php esc_html_e( 'Send SMS',
												'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui toggle checkbox">
                                            <input type="checkbox"
                                                   name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_send_after_aliexpress_order_synced]"
                                                   id="<?php echo esc_attr( self::set( 'sms_send_after_aliexpress_order_synced' ) ) ?>"
                                                   value="1" <?php checked( $this->settings->get_params( 'sms_send_after_aliexpress_order_synced' ), '1' ) ?>><label></label>
                                        </div>
                                        <p class="description"><?php esc_html_e( 'When syncing AliExpress orders(by ALD plugin), send SMS to customers if tracking number updated or tracking status switches to delivered',
												'woocommerce-orders-tracking' ) ?></p>
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'paypal_add_after_aliexpress_order_synced' ) ) ?>"><?php esc_html_e( 'Add tracking number to PayPal',
												'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui toggle checkbox">
                                            <input type="checkbox"
                                                   name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[paypal][paypal_add_after_aliexpress_order_synced]"
                                                   id="<?php echo esc_attr( self::set( 'paypal_add_after_aliexpress_order_synced' ) ) ?>"
                                                   value="1" <?php checked( $this->settings->get_params( 'paypal_add_after_aliexpress_order_synced' ), '1' ) ?>><label></label>
                                        </div>
                                        <p class="description"><?php esc_html_e( 'When syncing AliExpress orders(by ALD plugin), automatically add tracking number to PayPal. Make sure you configure PayPal API correctly',
												'woocommerce-orders-tracking' ) ?></p>
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
						<?php
					}
					?>
                    <div class="vi-ui bottom attached tab segment" data-tab="integration">
                        <table class="form-table">
                            <tbody>
                            <tr>
                                <th>
                                    <label for="<?php echo esc_attr( self::set( 'save_carrier_name_in_post_meta' ) ) ?>"><?php esc_html_e( 'Save carrier (display)name in post meta',
											'woocommerce-orders-tracking' ) ?></label>
                                </th>
                                <td>
                                    <div class="vi-ui toggle checkbox">
                                        <input type="checkbox"
                                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[save_carrier_name_in_post_meta]"
                                               id="<?php echo esc_attr( self::set( 'save_carrier_name_in_post_meta' ) ) ?>"
                                               value="1" <?php checked( $this->settings->get_params( 'save_carrier_name_in_post_meta' ), '1' ) ?>><label><?php esc_html_e( 'Yes',
												'woocommerce-orders-tracking' ) ?></label>
                                    </div>
                                    <p><?php printf( esc_html__( 'If enabled, carrier\'s display name will be saved to %s post meta so that you can use this meta to integrate with other plugins',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
											'woocommerce-orders-tracking' ), '<strong>_wot_tracking_carrier_name</strong>' ) ?></p>
                                    <p>
                                        <strong>*</strong><?php esc_html_e( 'This is only used for orders that a tracking number is used for the whole order(manage tracking by order only)',
											'woocommerce-orders-tracking' ) ?>
                                    </p>
                                </td>
                            </tr>
                            </tbody>
                        </table>
						<?php
						do_action( 'woo_orders_tracking_settings_integration', $this->settings );
						?>
                    </div>
					<?php
					if ( current_user_can( 'manage_options' ) ) {
						?>
                        <div class="vi-ui bottom attached tab segment" data-tab="update">
                            <table class="form-table">
                                <tr>
                                    <th>
                                        <label for="auto-update-key"><?php esc_html_e( 'Auto Update Key', 'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="fields">
                                            <div class="ten wide field">
                                                <input type="text"
                                                       name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[key]"
                                                       id="auto-update-key"
                                                       class="villatheme-autoupdate-key-field"
                                                       value="<?php echo esc_attr( $this->settings->get_params( 'key' ) ); ?>">
                                            </div>
                                            <div class="six wide field">
                                        <span class="vi-ui small button green villatheme-get-key-button"
                                              data-href="https://api.envato.com/authorization?response_type=code&client_id=villatheme-download-keys-6wzzaeue&redirect_uri=https://villatheme.com/update-key"
                                              data-id="26062993"><?php esc_html_e( 'Get Key', 'woocommerce-orders-tracking' ) ?></span>
                                            </div>
                                        </div>
										<?php do_action( 'woocommerce-orders-tracking_key' ) ?>
                                        <p><?php echo wp_kses_post( __( 'Please enter the key that you get from <a target="_blank" href="https://villatheme.com/my-download">https://villatheme.com/my-download</a> to enable auto update for WooCommerce Orders Tracking plugin. Please read <a target="_blank" href="https://villatheme.com/knowledge-base/how-to-use-auto-update-feature/">guide</a>',
												'woocommerce-orders-tracking' ) ) ?></p>
                                    </td>
                                </tr>
                            </table>
                        </div>
						<?php
					}
					do_action( 'vi_wot_tab_settings' );
					?>
                    <p class="<?php echo esc_attr( self::set( 'button-save-settings-container' ) ) ?>">
                        <button type="submit"
                                name="<?php echo esc_attr( self::set( 'settings-save-button' ) ) ?>"
                                class="<?php echo esc_attr( self::set( 'settings-save-button' ) ) ?> vi-ui button primary labeled icon">
                            <i class="icon save"></i>
							<?php esc_html_e( 'Save', 'woocommerce-orders-tracking' ); ?>
                        </button>
                        <button class="vi-ui button labeled icon" type="submit"
                                name="<?php echo esc_attr( self::set( 'check_key', true ) ) ?>"><i
                                    class="icon save"></i>
							<?php esc_html_e( 'Save & Check Key', 'woocommerce-orders-tracking' ); ?>
                        </button>
                    </p>
                </form>
            </div>
        </div>
		<?php
		do_action( 'villatheme_support_woocommerce-orders-tracking' );
	}

	private function shipping_carriers_settings() {
		$countries = new WC_Countries();
		$countries = $countries->get_countries();
		?>
        <div class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-overlay', 'hidden' ) ) ) ?>">
        </div>
        <div class="vi-ui positive small message"><?php esc_html_e( 'To turn off a carrier that is currently the default carrier(the first one), you first have to set another carrier as the default by hovering over it then click the pointing hand icon.',
				'woocommerce-orders-tracking' ) ?></div>
        <div class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-header' ) ) ) ?>">
            <div class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-filter-wrap' ) ) ) ?>">
                <div class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-filter-type-wrap' ) ) ) ?>">
                    <select id="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-filter-type' ) ) ) ?>"
                            class="vi-ui dropdown fluid <?php echo esc_attr( self::set( array( 'setting-shipping-carriers-filter-type' ) ) ) ?>">
                        <option value="all"><?php esc_html_e( 'All Carriers', 'woocommerce-orders-tracking' ) ?></option>
                        <option value="custom"><?php esc_html_e( 'Custom Carriers ', 'woocommerce-orders-tracking' ) ?></option>
                    </select>
                </div>
                <div class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-filter-country-wrap' ) ) ) ?>">
                    <select id="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-filter-country' ) ) ) ?>"
                            class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-filter-country' ) ) ) ?>">
                        <option value="all_country"
                                selected><?php esc_html_e( 'All Countries ', 'woocommerce-orders-tracking' ) ?></option>
                        <option value="Global"><?php esc_html_e( 'Global', 'woocommerce-orders-tracking' ) ?></option>
						<?php
						foreach ( $countries as $country_code => $country_name ) {
							?>
                            <option value="<?php echo esc_attr( $country_code ) ?>"><?php echo esc_html( $country_name ) ?></option>
							<?php
						}
						?>
                    </select>
                </div>
            </div>
            <div class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-search-wrap' ) ) ) ?>">
                <div class="vi-ui segment <?php echo esc_attr( self::set( array( 'setting-shipping-carriers-toggle-active-wrap' ) ) ) ?>">
                    <div class="vi-ui fitted toggle checkbox"
                         title="<?php echo esc_attr__( 'Toggle active status of all carrier on/off', 'woocommerce-orders-tracking' ) ?>">
                        <input type="checkbox"
                               class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-toggle-active' ) ) ) ?>"><label></label>
                    </div>
                </div>
                <span class="vi-ui button olive <?php echo esc_attr( self::set( array( 'setting-shipping-carriers-add-new-carrier' ) ) ) ?>"><?php esc_html_e( 'Add Carriers',
						'woocommerce-orders-tracking' ) ?></span>
            </div>
        </div>
        <div class="<?php echo esc_attr( self::set( array( 'setting-shipping-carriers-list-wrap' ) ) ) ?>">
        </div>
        <div class="<?php echo esc_attr( self::set( array(
			'setting-shipping-carriers-list-search-wrap',
			'hidden'
		) ) ) ?>">
            <p><?php echo wp_kses_post( sprintf( __( 'Unable to find your needed shipping carrier? Please <a class="%s" href="#">click here</a> to add your own carrier.',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
					'woocommerce-orders-tracking' ), self::set( array( 'setting-shipping-carriers-add-new-carrier-shortcut' ) ) ) ) ?></p>
            <iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/8NZwSnSWsIg?start=425"
                    title="YouTube video player" frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen></iframe>
        </div>
		<?php
	}

	private function email_settings() {
		if ( $this->schedule_send_emails ) {
			$orders = get_option( 'vi_wot_send_mails_for_import_csv_function_orders' );
			if ( $orders ) {
				$orders = vi_wot_json_decode( $orders );
				if ( count( $orders ) ) {
					$gmt_offset = intval( get_option( 'gmt_offset' ) );
					?>
                    <div class="vi-ui positive message">
                        <div class="header">
							<?php echo wp_kses_post( sprintf( __( 'Next schedule: <strong>%s</strong>', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
								date_i18n( 'F j, Y g:i:s A', ( $this->schedule_send_emails + HOUR_IN_SECONDS * $gmt_offset ) ) ) ); ?>
                        </div>
                        <p><?php echo wp_kses_post( sprintf( esc_html__( 'Order(s) to send next: %s', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
								implode( ',', array_splice( $orders, 0, $this->settings->get_params( 'email_number_send' ) ) ) ) ); ?></p>
                    </div>
					<?php
				}
			}
		}
		?>
        <div class="vi-ui positive message">
            <div>
				<?php esc_html_e( 'Settings for sending individual email if you check the send email checkbox(when editing order tracking/importing tracking/Webhooks)',
					'woocommerce-orders-tracking' ) ?>
            </div>
        </div>
        <table class="form-table">
            <tbody>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_send_all_order_items' ) ) ?>"><?php esc_html_e( 'Send tracking of whole order',
							'woocommerce-orders-tracking' ) ?></label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_send_all_order_items]"
                               id="<?php echo esc_attr( self::set( 'email_send_all_order_items' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'email_send_all_order_items' ), '1' ) ?>><label></label>
                    </div>
                    <p class="description"><?php esc_html_e( '{tracking_table} will include tracking of all items of an order instead of only changed one. Helpful when you add tracking number for single item of an order.',
							'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_cc' ) ) ?>">
						<?php esc_attr_e( 'Extra CC address', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <input type="text" name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_cc]"
                           value="<?php echo esc_attr( $this->settings->get_params( 'email_cc' ) ) ?>"
                           id="<?php echo esc_attr( self::set( 'email_cc' ) ) ?>">
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_bcc' ) ) ?>">
						<?php esc_attr_e( 'Extra BCC address', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <input type="text" name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_bcc]"
                           value="<?php echo esc_attr( $this->settings->get_params( 'email_bcc' ) ) ?>"
                           id="<?php echo esc_attr( self::set( 'email_bcc' ) ) ?>">
                </td>
            </tr>
			<?php
			$email_template = $this->settings->get_params( 'email_template' );
			?>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_template' ) ) ?>"><?php esc_html_e( 'Email template', 'woocommerce-orders-tracking' ) ?></label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'email_template' );
					$email_templates = self::get_email_templates();
					?>
                    <select class="vi-ui dropdown" id="<?php echo esc_attr( self::set( 'email_template' ) ) ?>"
                            type="text"
                            name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email_template]">
                        <option value=""><?php esc_html_e( 'None', 'woocommerce-orders-tracking' ) ?></option>
						<?php
						if ( count( $email_templates ) ) {
							foreach ( $email_templates as $email_template_k => $email_template_v ) {
								?>
                                <option value="<?php echo esc_attr( $email_template_v->ID ); ?>" <?php selected( $email_template_v->ID,
									$email_template ); ?>><?php echo esc_html( "(#{$email_template_v->ID}){$email_template_v->post_title}" ); ?></option>
								<?php
							}
						}
						?>
                    </select>
					<?php
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							$email_template_lang = $this->settings->get_params( 'email_template', '', $value );
							$this->print_other_country_flag( 'email_template', $value );
							?>
                            <select class="vi-ui dropdown"
                                    id="<?php echo esc_attr( self::set( "email_template_{$value}" ) ) ?>" type="text"
                                    name="<?php echo esc_attr( self::set( "settings[email_template_{$value}]" ) ) ?>">
                                <option value=""><?php esc_html_e( 'None', 'woocommerce-orders-tracking' ) ?></option>
								<?php
								if ( count( $email_templates ) ) {
									foreach ( $email_templates as $email_template_k => $email_template_v ) {
										?>
                                        <option value="<?php echo esc_attr( $email_template_v->ID ); ?>" <?php selected( $email_template_v->ID,
											$email_template_lang ); ?>><?php echo esc_html( "(#{$email_template_v->ID}){$email_template_v->post_title}" ); ?></option>
										<?php
									}
								}
								?>
                            </select>
							<?php
						}
					}
					?>
                    <p><?php echo wp_kses_post( __( 'You can use <a href="https://1.envato.market/BZZv1" target="_blank">WooCommerce Email Template Customizer</a> or <a href="http://bit.ly/woo-email-template-customizer" target="_blank">Email Template Customizer for WooCommerce</a> to create and customize your own email template. If no email template is selected, below email will be used.',
							'woocommerce-orders-tracking' ) ) ?></p>
					<?php
					if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::is_email_template_customizer_active() ) {
						?>
                        <p>
                            <a href="edit.php?post_type=viwec_template"
                               target="_blank"><?php esc_html_e( 'View all Email templates', 'woocommerce-orders-tracking' ) ?></a>
							<?php esc_html_e( 'or', 'woocommerce-orders-tracking' ) ?>
                            <a href="post-new.php?post_type=viwec_template&sample=wot_email&style=basic"
                               target="_blank"><?php esc_html_e( 'Create a new email template', 'woocommerce-orders-tracking' ) ?></a>
                        </p>
						<?php
					}
					?>
                </td>
            </tr>
            </tbody>
        </table>
        <div class="vi-ui segment">
            <div class="vi-ui message"><?php esc_html_e( 'This email is used when no Email template is selected', 'woocommerce-orders-tracking' ) ?></div>
            <table class="form-table">
                <tbody>
                <tr>
                    <th>
                        <label for="<?php echo esc_attr( self::set( 'setting-email-subject' ) ) ?>">
							<?php esc_html_e( 'Email subject', 'woocommerce-orders-tracking' ) ?>
                        </label>
                    </th>
                    <td>
						<?php
						$this->default_language_flag_html( 'setting-email-subject' );
						?>
                        <input type="text"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_subject]"
                               id="<?php echo esc_attr( self::set( 'setting-email-subject' ) ) ?>"
                               value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'email_subject' ) ) ) ?>">
						<?php
						if ( count( $this->languages ) ) {
							foreach ( $this->languages as $key => $value ) {
								?>
                                <p>
                                    <label for="<?php echo esc_attr( self::set( "setting-email-subject_{$value}" ) ) ?>"><?php
										if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
											?>
                                            <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
											<?php
										}
										echo wp_kses_post( $value );
										if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
											echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
										}
										?>:</label>
                                </p>
                                <input id="<?php echo esc_attr( self::set( "setting-email-subject_{$value}" ) ) ?>"
                                       type="text"
                                       name="<?php echo esc_attr( self::set( "settings[email][email_subject_{$value}]" ) ) ?>"
                                       value="<?php echo esc_attr( stripslashes( $this->settings->get_params( 'email_subject', '', $value ) ) ); ?>">
								<?php
							}
						}
						?>
                    </td>
                </tr>
                <tr>
                    <th>
                        <label for="<?php echo esc_attr( self::set( 'setting-email-heading' ) ) ?>">
							<?php esc_html_e( 'Email heading', 'woocommerce-orders-tracking' ) ?>
                        </label>
                    </th>
                    <td>
						<?php
						$this->default_language_flag_html( 'setting-email-heading' );
						?>
                        <input type="text"

                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_heading]"

                               id="<?php echo esc_attr( self::set( 'setting-email-heading' ) ) ?>"

                               value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'email_heading' ) ) ) ?>">
						<?php
						if ( count( $this->languages ) ) {
							foreach ( $this->languages as $key => $value ) {
								?>
                                <p>
                                    <label for="<?php echo esc_attr( self::set( "setting-email-heading_{$value}" ) ) ?>"><?php
										if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
											?>
                                            <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
											<?php
										}
										echo wp_kses_post( $value );
										if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
											echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
										}
										?>:</label>
                                </p>
                                <input id="<?php echo esc_attr( self::set( "setting-email-heading_{$value}" ) ) ?>"
                                       type="text"
                                       name="<?php echo esc_attr( self::set( "settings[email][email_heading_{$value}]" ) ) ?>"
                                       value="<?php echo esc_attr( stripslashes( $this->settings->get_params( 'email_heading', '', $value ) ) ); ?>">
								<?php
							}
						}
						?>
                    </td>
                </tr>
                <tr>
                    <th>
                        <label for="<?php echo esc_attr( self::set( 'setting-email-content' ) ) ?>">
							<?php esc_html_e( 'Email content', 'woocommerce-orders-tracking' ) ?>
                        </label>
                    </th>
                    <td>
						<?php
						$this->default_language_flag_html( 'email_content' );
						wp_editor( stripslashes( $this->settings->get_params( 'email_content' ) ), 'wot-email-content', array(

							'editor_height' => 300,

							'textarea_name' => 'woo-orders-tracking-settings[email][email_content]'

						) );
						if ( count( $this->languages ) ) {
							foreach ( $this->languages as $key => $value ) {
								?>
                                <p>
                                    <label for="<?php echo esc_attr( "wot-email-content_{$value}" ) ?>"><?php
										if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
											?>
                                            <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
											<?php
										}
										echo wp_kses_post( $value );
										if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
											echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
										}
										?>:</label>
                                </p>
								<?php
								wp_editor( stripslashes( $this->settings->get_params( 'email_content', '', $value ) ), "wot-email-content_{$value}", array(
									'editor_height' => 300,
									'textarea_name' => "woo-orders-tracking-settings[email][email_content_{$value}]"
								) );
							}
						}
						self::table_of_placeholders( array(
								'tracking_table'     => esc_html__( 'Table of order items and their respective tracking info', 'woocommerce-orders-tracking' ),
								'order_id'           => esc_html__( 'ID of current order', 'woocommerce-orders-tracking' ),
								'order_number'       => esc_html__( 'Order number', 'woocommerce-orders-tracking' ),
								'billing_first_name' => esc_html__( 'Billing first name', 'woocommerce-orders-tracking' ),
								'billing_last_name'  => esc_html__( 'Billing last name', 'woocommerce-orders-tracking' ),
								'tracking_number'    => esc_html__( 'First found Tracking number', 'woocommerce-orders-tracking' ),
								'tracking_url'       => esc_html__( 'Tracking url of first found Tracking number', 'woocommerce-orders-tracking' ),
								'carrier_name'       => esc_html__( 'Carrier name of first found Tracking number', 'woocommerce-orders-tracking' ),
								'carrier_url'        => esc_html__( 'Carrier url of first found Tracking number', 'woocommerce-orders-tracking' ),
							)
						);
						?>
                    </td>
                </tr>
                <tr>
                    <th>
                        <label for="<?php echo esc_attr( self::set( 'email_column_tracking_number' ) ) ?>">
							<?php esc_html_e( 'Tracking number column', 'woocommerce-orders-tracking' ) ?>
                        </label>
                    </th>
                    <td>
						<?php
						$this->default_language_flag_html( 'email_column_tracking_number' );
						wp_editor( stripslashes( $this->settings->get_params( 'email_column_tracking_number' ) ), 'wot-email_column_tracking_number', array(
							'editor_height' => 50,
							'textarea_name' => 'woo-orders-tracking-settings[email][email_column_tracking_number]',
						) );
						if ( count( $this->languages ) ) {
							foreach ( $this->languages as $key => $value ) {
								?>
                                <p>
                                    <label for="<?php echo esc_attr( "wot-email_column_tracking_number_{$value}" ) ?>"><?php
										if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
											?>
                                            <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
											<?php
										}
										echo wp_kses_post( $value );
										if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
											echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
										}
										?>:</label>
                                </p>
								<?php
								wp_editor( stripslashes( $this->settings->get_params( 'email_column_tracking_number', '', $value ) ), "wot-email_column_tracking_number_{$value}",
									array(
										'editor_height' => 50,
										'textarea_name' => "woo-orders-tracking-settings[email][email_column_tracking_number_{$value}]"
									) );
							}
						}
						?>
                    </td>
                </tr>
                <tr>
                    <th>
                        <label for="<?php echo esc_attr( self::set( 'email_column_carrier_name' ) ) ?>">
							<?php esc_html_e( 'Carrier name column', 'woocommerce-orders-tracking' ) ?>
                        </label>
                    </th>
                    <td>
						<?php
						$this->default_language_flag_html( 'email_column_carrier_name' );
						wp_editor( stripslashes( $this->settings->get_params( 'email_column_carrier_name' ) ), 'wot-email_column_carrier_name', array(
							'editor_height' => 50,
							'textarea_name' => 'woo-orders-tracking-settings[email][email_column_carrier_name]',
						) );
						if ( count( $this->languages ) ) {
							foreach ( $this->languages as $key => $value ) {
								?>
                                <p>
                                    <label for="<?php echo esc_attr( "wot-email_column_carrier_name_{$value}" ) ?>"><?php
										if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
											?>
                                            <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
											<?php
										}
										echo wp_kses_post( $value );
										if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
											echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
										}
										?>:</label>
                                </p>
								<?php
								wp_editor( stripslashes( $this->settings->get_params( 'email_column_carrier_name', '', $value ) ), "wot-email_column_carrier_name_{$value}", array(
									'editor_height' => 50,
									'textarea_name' => "woo-orders-tracking-settings[email][email_column_carrier_name_{$value}]"
								) );
							}
						}
						?>
                    </td>
                </tr>
                <tr>
                    <th>
                        <label for="<?php echo esc_attr( self::set( 'email_column_tracking_url' ) ) ?>">
							<?php esc_html_e( 'Tracking url column', 'woocommerce-orders-tracking' ) ?>
                        </label>
                    </th>
                    <td>
						<?php
						$this->default_language_flag_html( 'email_column_tracking_url' );
						wp_editor( stripslashes( $this->settings->get_params( 'email_column_tracking_url' ) ), 'wot-email_column_tracking_url', array(
							'editor_height' => 50,
							'textarea_name' => 'woo-orders-tracking-settings[email][email_column_tracking_url]',
						) );
						if ( count( $this->languages ) ) {
							foreach ( $this->languages as $key => $value ) {
								?>
                                <p>
                                    <label for="<?php echo esc_attr( "wot-email_column_tracking_url_{$value}" ) ?>"><?php
										if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
											?>
                                            <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
											<?php
										}
										echo wp_kses_post( $value );
										if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
											echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
										}
										?>:</label>
                                </p>
								<?php
								wp_editor( stripslashes( $this->settings->get_params( 'email_column_tracking_url', '', $value ) ), "wot-email_column_tracking_url_{$value}", array(
									'editor_height' => 50,
									'textarea_name' => "woo-orders-tracking-settings[email][email_column_tracking_url_{$value}]"
								) );
							}
						}
						?>
                        <p><?php esc_html_e( '{tracking_table} contains 4 columns and you can customize 3 of them, the first column is Product title and it\'s mandatory.',
								'woocommerce-orders-tracking' ) ?></p>
                        <p><?php esc_html_e( 'You can leave column content blank to remove it from {tracking_table}.', 'woocommerce-orders-tracking' ) ?></p>
                        <p><?php esc_html_e( 'Below placeholders can be used in both 3 columns of {tracking_table}', 'woocommerce-orders-tracking' ) ?></p>
						<?php
						self::table_of_placeholders( array(
								'tracking_number' => esc_html__( 'Tracking number', 'woocommerce-orders-tracking' ),
								'tracking_url'    => esc_html__( 'Tracking url', 'woocommerce-orders-tracking' ),
								'carrier_name'    => esc_html__( 'Carrier name', 'woocommerce-orders-tracking' ),
								'carrier_url'     => esc_html__( 'Carrier url', 'woocommerce-orders-tracking' ),
							)
						);
						?>
                    </td>
                </tr>
                </tbody>
            </table>
        </div>
        <table class="form-table">
            <tbody>
            <tr>
                <td colspan="2">
                    <div class="vi-ui positive message">
                        <div class="header">
							<?php esc_html_e( 'Settings for sending emails when importing tracking numbers', 'woocommerce-orders-tracking' ) ?>
                        </div>
                    </div>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_number_send' ) ) ?>">
						<?php esc_html_e( 'Number of emails sent per time', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="number" min="1"
                           class="<?php echo esc_attr( self::set( 'email_number_send' ) ) ?>"
                           id="<?php echo esc_attr( self::set( 'email_number_send' ) ) ?>"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_number_send]"
                           value="<?php echo esc_attr( $this->settings->get_params( 'email_number_send' ) ) ?>">
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_time_send' ) ) ?>">
						<?php esc_html_e( 'Delay between each time', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui right labeled input">
                        <input type="number" min="0"
                               class="<?php echo esc_attr( self::set( 'email_time_send' ) ) ?>"
                               id="<?php echo esc_attr( self::set( 'email_time_send' ) ) ?>"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_time_send]"
                               value="<?php echo esc_attr( $this->settings->get_params( 'email_time_send' ) ) ?>">
                        <label for="amount"
                               class="vi-ui label">
                            <select name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email][email_time_send_type]"
                                    id="<?php echo esc_attr( self::set( 'email_time_send_type' ) ) ?>"
                                    class="vi-ui dropdown <?php echo esc_attr( self::set( 'email_time_send_type' ) ) ?>">
								<?php
								$delay_time_type = array(
									'day'    => esc_html__( 'Day', 'woocommerce-orders-tracking' ),
									'hour'   => esc_html__( 'Hour', 'woocommerce-orders-tracking' ),
									'minute' => esc_html__( 'Minute', 'woocommerce-orders-tracking' ),
								);
								foreach ( $delay_time_type as $key => $value ) {
									$selected = '';
									if ( $this->settings->get_params( 'email_time_send_type' ) == $key ) {
										$selected = 'selected="selected"';
									}
									?>
                                    <option value="<?php echo esc_attr( $key ) ?>" <?php echo esc_attr( $selected ) ?>><?php echo esc_html( $value ) ?></option>
									<?php
								}
								?>
                            </select>
                        </label>
                    </div>
                    <p class="description"><?php esc_html_e( 'If you import tracking numbers for 100 orders and all 100 orders have tracking numbers updated, not all 100 emails will be sent at a time.',
							'woocommerce-orders-tracking' ) ?></p>
                    <p class="description"><?php echo wp_kses_post( __( 'If you set <strong>"Number of emails sent per time"</strong> to 10 and <strong>"Delay between each time"</strong> to 10 minutes, by the time the import completes, it will send 10 first email and wait 10 minutes to send next 10 emails and continue this until all emails are sent.',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>
            </tbody>
        </table>
		<?php
	}

	private function sms_settings() {
		$sms_provider  = $this->settings->get_params( 'sms_provider' );
		$sms_providers = array(
			'twilio' => 'Twilio',
			'nexmo'  => 'Nexmo',
			'plivo'  => 'Plivo'
		)
		?>
        <table class="form-table">
            <tbody>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_text_new' ) ) ?>">
						<?php esc_html_e( 'Message text when new tracking is added', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'sms_text_new' );
					?>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_text_new]"
                           id="<?php echo esc_attr( self::set( 'sms_text_new' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_text_new' ) ) ) ?>">
					<?php
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							?>
                            <p>
                                <label for="<?php echo esc_attr( self::set( "setting-email-sms_text_new_{$value}" ) ) ?>"><?php
									if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
										?>
                                        <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
										<?php
									}
									echo wp_kses_post( $value );
									if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
										echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
									}
									?>:</label>
                            </p>
                            <input id="<?php echo esc_attr( self::set( "setting-email-sms_text_new_{$value}" ) ) ?>"
                                   type="text"
                                   name="<?php echo esc_attr( self::set( "settings[sms_text_new_{$value}]" ) ) ?>"
                                   value="<?php echo esc_attr( stripslashes( $this->settings->get_params( 'sms_text_new', '', $value ) ) ); ?>">
							<?php
						}
					}
					?>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_text' ) ) ?>">
						<?php esc_html_e( 'Message text when tracking changes', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'sms_text' );
					?>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_text]"
                           id="<?php echo esc_attr( self::set( 'sms_text' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_text' ) ) ) ?>">
					<?php
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							?>
                            <p>
                                <label for="<?php echo esc_attr( self::set( "setting-email-sms_text_{$value}" ) ) ?>"><?php
									if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
										?>
                                        <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
										<?php
									}
									echo wp_kses_post( $value );
									if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
										echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
									}
									?>:</label>
                            </p>
                            <input id="<?php echo esc_attr( self::set( "setting-email-sms_text_{$value}" ) ) ?>"
                                   type="text"
                                   name="<?php echo esc_attr( self::set( "settings[sms_text_{$value}]" ) ) ?>"
                                   value="<?php echo wp_kses_post( stripslashes( $this->settings->get_params( 'sms_text', '', $value ) ) ); ?>">
							<?php
						}
					}
					self::table_of_placeholders( array(
							'order_id'           => esc_html__( 'ID of current order', 'woocommerce-orders-tracking' ),
							'order_number'       => esc_html__( 'Order number', 'woocommerce-orders-tracking' ),
							'billing_first_name' => esc_html__( 'Billing first name', 'woocommerce-orders-tracking' ),
							'billing_last_name'  => esc_html__( 'Billing last name', 'woocommerce-orders-tracking' ),
							'tracking_number'    => esc_html__( 'The tracking number', 'woocommerce-orders-tracking' ),
							'tracking_url'       => esc_html__( 'The tracking URL', 'woocommerce-orders-tracking' ),
							'carrier_name'       => esc_html__( 'Carrier name', 'woocommerce-orders-tracking' ),
							'carrier_url'        => esc_html__( 'Carrier URL', 'woocommerce-orders-tracking' ),
						)
					);
					?>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_provider' ) ) ?>">
						<?php esc_html_e( 'SMS provider', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <select class="vi-ui dropdown"
                            name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_provider]"
                            id="<?php echo esc_attr( self::set( 'sms_provider' ) ) ?>">
						<?php
						foreach ( $sms_providers as $sms_provider_k => $sms_provider_v ) {
							?>
                            <option value="<?php echo esc_attr( $sms_provider_k ) ?>" <?php selected( $sms_provider_k,
								$sms_provider ) ?>><?php echo esc_html( $sms_provider_v ) ?></option>
							<?php
						}
						?>
                    </select>
                </td>
            </tr>
            <tr class="<?php echo esc_attr( $sms_provider === 'plivo' ? self::set( 'hidden' ) : '' ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_from_number' ) ) ?>">
						<?php esc_html_e( 'From number', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'sms_from_number' );
					?>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_from_number]"
                           id="<?php echo esc_attr( self::set( 'sms_from_number' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_from_number' ) ) ) ?>">
					<?php
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							?>
                            <p>
                                <label for="<?php echo esc_attr( self::set( "setting-email-sms_from_number_{$value}" ) ) ?>"><?php
									if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
										?>
                                        <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
										<?php
									}
									echo wp_kses_post( $value );
									if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
										echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
									}
									?>:</label>
                            </p>
                            <input id="<?php echo esc_attr( self::set( "setting-email-sms_from_number_{$value}" ) ) ?>"
                                   type="text"
                                   name="<?php echo esc_attr( self::set( "settings[sms_from_number_{$value}]" ) ) ?>"
                                   value="<?php echo esc_attr( stripslashes( $this->settings->get_params( 'sms_from_number', '', $value ) ) ); ?>">
							<?php
						}
					}
					?>
                </td>
            </tr>
			<?php
			$sms_twilio_app = array( 'sms_twilio_app' );
			$sms_nexmo_app  = array( 'sms_nexmo_app' );
			$sms_plivo_app  = array( 'sms_plivo_app' );
			switch ( $sms_provider ) {
				case 'twilio':
					$sms_nexmo_app[] = 'hidden';
					$sms_plivo_app[] = 'hidden';
					break;
				case 'nexmo':
					$sms_twilio_app[] = 'hidden';
					$sms_plivo_app[]  = 'hidden';
					break;
				case 'plivo':
					$sms_nexmo_app[]  = 'hidden';
					$sms_twilio_app[] = 'hidden';
					break;
				default:
			}
			?>
            <tr class="<?php echo esc_attr( self::set( $sms_twilio_app ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_twilio_app_id' ) ) ?>">
						<?php esc_html_e( 'ACCOUNT SID', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_twilio_app_id]"
                           id="<?php echo esc_attr( self::set( 'sms_twilio_app_id' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_twilio_app_id' ) ) ) ?>">
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $sms_twilio_app ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_twilio_app_token' ) ) ?>">
						<?php esc_html_e( 'AUTH TOKEN', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_twilio_app_token]"
                           id="<?php echo esc_attr( self::set( 'sms_twilio_app_token' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_twilio_app_token' ) ) ) ?>">
                    <p class="description"><?php echo wp_kses_post( __( 'To get Twilio Access Token, please read <a href="https://www.twilio.com/docs/iam/access-tokens" target="_blank">Twilio API: Access Tokens</a>',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $sms_nexmo_app ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_nexmo_app_id' ) ) ?>">
						<?php esc_html_e( 'API Key', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_nexmo_app_id]"
                           id="<?php echo esc_attr( self::set( 'sms_nexmo_app_id' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_nexmo_app_id' ) ) ) ?>">
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $sms_nexmo_app ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_nexmo_app_token' ) ) ?>">
						<?php esc_html_e( 'API Secret', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_nexmo_app_token]"
                           id="<?php echo esc_attr( self::set( 'sms_nexmo_app_token' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_nexmo_app_token' ) ) ) ?>">
                    <p class="description"><?php echo wp_kses_post( __( 'To get Nexmo API key and token, please read <a href="https://help.nexmo.com/hc/en-us/articles/204014493-Where-can-I-find-my-API-key-and-API-secret-" target="_blank">Where can I find my API key and API secret?</a>',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $sms_nexmo_app ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_nexmo_unicode' ) ) ?>">
						<?php esc_html_e( 'Enable unicode', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_nexmo_unicode]"
                               id="<?php echo esc_attr( self::set( 'sms_nexmo_unicode' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'sms_nexmo_unicode' ), '1' ) ?>><label
                                for="<?php echo esc_attr( self::set( 'sms_nexmo_unicode' ) ) ?>"><?php esc_html_e( 'Yes', 'woocommerce-orders-tracking' ) ?></label>
                    </div>
                    <p class="description"><?php echo wp_kses_post( __( 'Only enable this option if your message contains Unicode characters because Unicode messages can only contain 70 characters, rather than the usual 160. There\'s more information about this <a href="https://help.nexmo.com/hc/en-us/articles/204076866-How-long-is-a-single-SMS-body-" target="_blank">on the help page</a>',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $sms_plivo_app ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_plivo_app_id' ) ) ?>">
						<?php esc_html_e( 'Auth ID', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_plivo_app_id]"
                           id="<?php echo esc_attr( self::set( 'sms_plivo_app_id' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_plivo_app_id' ) ) ) ?>">
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $sms_plivo_app ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_plivo_app_token' ) ) ?>">
						<?php esc_html_e( 'Auth Token', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_plivo_app_token]"
                           id="<?php echo esc_attr( self::set( 'sms_plivo_app_token' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_plivo_app_token' ) ) ) ?>">
                    <p class="description"><?php echo wp_kses_post( __( 'To get Plivo Access Token, please read <a href="https://support.plivo.com/support/solutions/articles/17000089755-auth-id-and-auth-token" target="_blank">Auth ID and Auth Token</a>',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $sms_plivo_app ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'sms_plivo_powerpack_uuid' ) ) ?>">
						<?php esc_html_e( 'Powerpack UUID', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[sms_plivo_powerpack_uuid]"
                           id="<?php echo esc_attr( self::set( 'sms_plivo_powerpack_uuid' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'sms_plivo_powerpack_uuid' ) ) ) ?>">
                    <p class="description"><?php echo wp_kses_post( __( 'To create power pack, please read <a href="https://www.plivo.com/docs/sms/powerpack" target="_blank">Getting started with Powerpack</a>',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'bitly_access_token' ) ) ?>">
						<?php esc_html_e( 'Bitly access token', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[bitly_access_token]"
                           id="<?php echo esc_attr( self::set( 'bitly_access_token' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'bitly_access_token' ) ) ) ?>">
                    <p class="description"><?php echo wp_kses_post( __( 'Using Bitly to shorten your tracking url helps reduce message characters. Please read <a href="https://support.bitly.com/hc/en-us/articles/230647907-How-do-I-find-my-OAuth-access-token-" target="_blank">How to get Access Token</a>',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'send_test_sms' ) ) ?>">
						<?php esc_html_e( 'Send test SMS', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui right labeled input wot-labeled-button">
                        <input type="text"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[send_test_sms]"
                               placeholder="<?php echo esc_attr__( 'Your phone number with area code', 'woocommerce-orders-tracking' ) ?>"
                               id="<?php echo esc_attr( self::set( 'send_test_sms' ) ) ?>"
                               class="<?php echo esc_attr( self::set( 'send_test_sms' ) ) ?>">
                        <label class="vi-ui label">
                            <span class="vi-ui positive small button <?php echo esc_attr( self::set( 'button-send-test-sms' ) ) ?>"><?php esc_html_e( 'Send',
		                            'woocommerce-orders-tracking' ) ?></span>
                        </label>
                    </div>
                </td>
            </tr>
            </tbody>
        </table>
		<?php
	}

	private function email_woo_settings() {
		?>
        <table class="form-table">
            <tbody>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-email-woo-enable' ) ) ?>">
						<?php esc_html_e( 'Include tracking in WooCommerce email', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email_woo][email_woo_enable]"
                               id="<?php echo esc_attr( self::set( 'setting-email-woo-enable' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'email_woo_enable' ), '1' ) ?>><label
                                for="<?php echo esc_attr( self::set( 'setting-email-woo-enable' ) ) ?>"><?php esc_html_e( 'Yes', 'woocommerce-orders-tracking' ) ?></label>
                    </div>
                    <p class="description"><?php esc_html_e( 'Tracking information will be included in selected emails below no matter you check the send email checkbox(when editing order tracking/importing tracking) or not',
							'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-email-woo-status' ) ) ?>">
						<?php esc_html_e( 'Order status email', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$email_woo_status   = $this->settings->get_params( 'email_woo_status' );
					$email_woo_statuses = apply_filters( 'woocommerce_orders_tracking_email_woo_statuses', array(
						'cancelled_order'           => esc_html__( 'Cancelled', 'woocommerce-orders-tracking' ),
						'customer_completed_order'  => esc_html__( 'Completed', 'woocommerce-orders-tracking' ),
						'customer_invoice'          => esc_html__( 'Customer Invoice', 'woocommerce-orders-tracking' ),
						'customer_note'             => esc_html__( 'Customer Note', 'woocommerce-orders-tracking' ),
						'failed_order'              => esc_html__( 'Failed', 'woocommerce-orders-tracking' ),
						'customer_on_hold_order'    => esc_html__( 'On Hold', 'woocommerce-orders-tracking' ),
						'customer_processing_order' => esc_html__( 'Processing', 'woocommerce-orders-tracking' ),
						'customer_refunded_order'   => esc_html__( 'Refunded', 'woocommerce-orders-tracking' ),
					) );
					?>
                    <select name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email_woo][email_woo_status][]"
                            id="<?php echo esc_attr( self::set( 'setting-email-woo-status' ) ) ?>"
                            class="vi-ui fluid dropdown <?php echo esc_attr( self::set( 'setting-email-woo-status' ) ) ?>"
                            multiple>
						<?php
						foreach ( $email_woo_statuses as $email_woo_statuses_k => $email_woo_statuses_v ) {
							?>
                            <option value="<?php echo esc_attr( $email_woo_statuses_k ) ?>" <?php echo esc_attr( in_array( $email_woo_statuses_k, $email_woo_status ) ? 'selected'
								: "" ); ?>><?php echo esc_html( $email_woo_statuses_v ) ?></option>
							<?php
						}
						?>
                    </select>
                    <p class="description"><?php esc_html_e( 'Select orders status email to include the tracking information.', 'woocommerce-orders-tracking' ) ?></p>
                    <p class="description"><?php echo wp_kses_post( __( '<strong>*Note:</strong> If you use an email customizer plugin to send email, this option will be skipped. Tracking info will be included in all emails that <strong>contain order table</strong>.',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-email-woo-position' ) ) ?>">
						<?php esc_html_e( 'Tracking info position', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$email_woo_position  = $this->settings->get_params( 'email_woo_position' );
					$email_woo_positions = array(
						'before_order_table' => esc_html__( 'Before order table', 'woocommerce-orders-tracking' ),
						'after_order_item'   => esc_html__( 'After each order item', 'woocommerce-orders-tracking' ),
						'after_order_table'  => esc_html__( 'After order table', 'woocommerce-orders-tracking' ),
					);
					?>
                    <select name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[email_woo][email_woo_position]"
                            id="<?php echo esc_attr( self::set( 'setting-email-woo-position' ) ) ?>"
                            class="vi-ui dropdown <?php echo esc_attr( self::set( 'setting-email-woo-position' ) ) ?>">
						<?php
						foreach ( $email_woo_positions as $email_woo_position_k => $email_woo_position_v ) {
							?>
                            <option value="<?php echo esc_attr( $email_woo_position_k ) ?>" <?php selected( $email_woo_position,
								$email_woo_position_k ) ?>><?php echo esc_html( $email_woo_position_v ) ?></option>
							<?php
						}
						?>
                    </select>
                    <p class="description"><?php esc_html_e( 'Where in the email to place tracking information?', 'woocommerce-orders-tracking' ) ?></p>
					<?php
					if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::is_email_template_customizer_active() ) {
						?>
                        <p class="<?php echo esc_attr( self::set( 'setting-email-woo-position-before_order_table' ) ) ?> <?php if ( $email_woo_position !== 'before_order_table' ) {
							echo esc_attr( self::set( 'hidden' ) );
						} ?>"><?php echo wp_kses_post( __( '<strong>*Note: </strong>You have to add <strong>WC Hook</strong> and select hook "woocommerce_email_before_order_table" in the WooCommerce email that you want to include tracking info.',
								'woocommerce-orders-tracking' ) ) ?></p>
                        <p class="<?php echo esc_attr( self::set( 'setting-email-woo-position-after_order_table' ) ) ?> <?php if ( $email_woo_position !== 'after_order_table' ) {
							echo esc_attr( self::set( 'hidden' ) );
						} ?>"><?php echo wp_kses_post( __( '<strong>*Note: </strong>You have to add <strong>WC Hook</strong> and select hook "woocommerce_email_after_order_table" in the WooCommerce email that you want to include tracking info.',
								'woocommerce-orders-tracking' ) ) ?></p>
						<?php
					}
					?>
                </td>
            </tr>
			<?php
			$not_after_order_item_class = array( 'not_after_order_item' );
			if ( $email_woo_position === 'after_order_item' ) {
				$not_after_order_item_class[] = 'hidden';
			}
			?>
            <tr class="<?php echo esc_attr( self::set( $not_after_order_item_class ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_woo_html' ) ) ?>">
						<?php esc_html_e( 'Tracking content', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'email_woo_html' );
					wp_editor( stripslashes( $this->settings->get_params( 'email_woo_html' ) ), 'wot-email_woo_html', array(
						'editor_height' => 100,
						'textarea_name' => 'woo-orders-tracking-settings[email_woo][email_woo_html]',
					) );
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							?>
                            <p>
                                <label for="<?php echo esc_attr( "wot-email_woo_html_{$value}" ) ?>"><?php
									if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
										?>
                                        <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
										<?php
									}
									echo wp_kses_post( $value );
									if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
										echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
									}
									?>:</label>
                            </p>
							<?php
							wp_editor( stripslashes( $this->settings->get_params( 'email_woo_html', '', $value ) ), "wot-email_woo_html_{$value}", array(
								'editor_height' => 100,
								'textarea_name' => "woo-orders-tracking-settings[email_woo][email_woo_html_{$value}]"
							) );
						}
					}
					self::table_of_placeholders( array(
							'tracking_list'   => esc_html__( 'List of tracking info of an order', 'woocommerce-orders-tracking' ),
							'tracking_number' => esc_html__( 'First found Tracking number', 'woocommerce-orders-tracking' ),
							'tracking_url'    => esc_html__( 'Tracking url of first found Tracking number', 'woocommerce-orders-tracking' ),
							'carrier_name'    => esc_html__( 'Carrier name of first found Tracking number', 'woocommerce-orders-tracking' ),
							'carrier_url'     => esc_html__( 'Carrier url of first found Tracking number', 'woocommerce-orders-tracking' ),
						)
					);
					?>
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $not_after_order_item_class ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_woo_tracking_list_html' ) ) ?>">
						<?php esc_html_e( 'Tracking list item', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'email_woo_tracking_list_html' );
					wp_editor( stripslashes( $this->settings->get_params( 'email_woo_tracking_list_html' ) ), 'wot-email_woo_tracking_list_html', array(
						'editor_height' => 50,
						'textarea_name' => 'woo-orders-tracking-settings[email_woo][email_woo_tracking_list_html]',
					) );
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							?>
                            <p>
                                <label for="<?php echo esc_attr( "wot-email_woo_tracking_list_html_{$value}" ) ?>"><?php
									if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
										?>
                                        <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
										<?php
									}
									echo wp_kses_post( $value );
									if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
										echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
									}
									?>:</label>
                            </p>
							<?php
							wp_editor( stripslashes( $this->settings->get_params( 'email_woo_tracking_list_html', '', $value ) ), "wot-email_woo_tracking_list_html_{$value}",
								array(
									'editor_height' => 50,
									'textarea_name' => "woo-orders-tracking-settings[email_woo][email_woo_tracking_list_html_{$value}]"
								) );
						}
					}
					self::table_of_placeholders( array(
							'tracking_number' => esc_html__( 'Tracking number', 'woocommerce-orders-tracking' ),
							'tracking_url'    => esc_html__( 'Tracking url', 'woocommerce-orders-tracking' ),
							'carrier_name'    => esc_html__( 'Carrier name', 'woocommerce-orders-tracking' ),
							'carrier_url'     => esc_html__( 'Carrier url', 'woocommerce-orders-tracking' ),
						)
					);
					?>
                </td>
            </tr>
            <tr>
                <td colspan="2">
                    <div class="vi-ui positive small message">
                        <div>
							<?php echo wp_kses_post( __( 'You can customize tracking number and carrier html which are displayed <strong>after every order item</strong> in email(if selected) or on <strong>My account/Order details</strong> page',
								'woocommerce-orders-tracking' ) ) ?>
                        </div>
                    </div>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_woo_tracking_number_html' ) ) ?>">
						<?php esc_html_e( 'Tracking Number', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'email_woo_tracking_number_html' );
					wp_editor( stripslashes( $this->settings->get_params( 'email_woo_tracking_number_html' ) ), 'wot-email_woo_tracking_number_html', array(
						'editor_height' => 50,
						'textarea_name' => 'woo-orders-tracking-settings[email_woo][email_woo_tracking_number_html]',
					) );
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							?>
                            <p>
                                <label for="<?php echo esc_attr( "wot-email_woo_tracking_number_html_{$value}" ) ?>"><?php
									if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
										?>
                                        <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
										<?php
									}
									echo wp_kses_post( $value );
									if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
										echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
									}
									?>:</label>
                            </p>
							<?php
							wp_editor( stripslashes( $this->settings->get_params( 'email_woo_tracking_number_html', '', $value ) ), "wot-email_woo_tracking_number_html_{$value}",
								array(
									'editor_height' => 50,
									'textarea_name' => "woo-orders-tracking-settings[email_woo][email_woo_tracking_number_html_{$value}]"
								) );
						}
					}
					?>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'email_woo_tracking_carrier_html' ) ) ?>">
						<?php esc_html_e( 'Tracking Carrier', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'email_woo_tracking_carrier_html' );
					wp_editor( stripslashes( $this->settings->get_params( 'email_woo_tracking_carrier_html' ) ), 'wot-email_woo_tracking_carrier_html', array(
						'editor_height' => 50,
						'textarea_name' => 'woo-orders-tracking-settings[email_woo][email_woo_tracking_carrier_html]',
					) );
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							?>
                            <p>
                                <label for="<?php echo esc_attr( "wot-email_woo_tracking_carrier_html_{$value}" ) ?>"><?php
									if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
										?>
                                        <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
										<?php
									}
									echo wp_kses_post( $value );
									if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
										echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
									}
									?>:</label>
                            </p>
							<?php
							wp_editor( stripslashes( $this->settings->get_params( 'email_woo_tracking_carrier_html', '', $value ) ), "wot-email_woo_tracking_carrier_html_{$value}",
								array(
									'editor_height' => 50,
									'textarea_name' => "woo-orders-tracking-settings[email_woo][email_woo_tracking_carrier_html_{$value}]"
								) );
						}
					}
					self::table_of_placeholders( array(
							'tracking_number' => esc_html__( 'Tracking number', 'woocommerce-orders-tracking' ),
							'tracking_url'    => esc_html__( 'Tracking url', 'woocommerce-orders-tracking' ),
							'carrier_name'    => esc_html__( 'Carrier name', 'woocommerce-orders-tracking' ),
							'carrier_url'     => esc_html__( 'Carrier url', 'woocommerce-orders-tracking' ),
						)
					);
					?>
                </td>
            </tr>
            </tbody>
        </table>
		<?php
	}

	private function paypal_settings() {
		$available_gateways         = WC()->payment_gateways()->payment_gateways();
		$default                    = new stdClass();
		$default->id                = 'default';
		$default->method_title      = esc_html__( 'Default Live API', 'woocommerce-orders-tracking' );
		$available_paypal_methods   = array( $default );
		$default                    = new stdClass();
		$default->id                = 'default_sandbox';
		$default->method_title      = esc_html__( 'Default Sandbox API', 'woocommerce-orders-tracking' );
		$available_paypal_methods[] = $default;
		$supported_paypal_gateways  = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_supported_paypal_gateways();
		foreach ( $available_gateways as $method_id => $method ) {
			if ( in_array( $method_id, $supported_paypal_gateways ) ) {
				$available_paypal_methods[] = $method;
			}
		}
		if ( is_array( $available_paypal_methods ) && count( $available_paypal_methods ) ) {
			?>
            <div class="vi-ui positive message">
                <div class="header"><?php esc_html_e( 'Please follow these steps to get PayPal API Credentials', 'woocommerce-orders-tracking' ) ?></div>
                <ul class="list">
                    <li><?php printf( wp_kses_post( __( 'Go to %s and login with your PayPal account', 'woocommerce-orders-tracking' ) ), '<strong><a href="https://developer.paypal.com/developer/applications/" target="_blank">PayPal Developer</a></strong>' );// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment ?></li>
                    <li><?php echo wp_kses_post( __( 'Go to My Apps & Credentials and select the <strong>Live</strong> tab(for live API) or <strong>Sandbox</strong> tab(for sandbox API)',
							'woocommerce-orders-tracking' ) ) ?></li>
                    <li><?php esc_html_e( 'Click on Create App button', 'woocommerce-orders-tracking' ) ?></li>
                    <li><?php esc_html_e( 'Enter the name of your application and click Create App button', 'woocommerce-orders-tracking' ); ?></li>
                    <li><?php esc_html_e( 'Copy your Client ID and Secret and paste them to Client Id and Client Secret fields', 'woocommerce-orders-tracking' ); ?></li>
                    <li><?php esc_html_e( 'If you use the same API for all PayPal payments, you only need to enter API for the default Live/Sandbox API field',
							'woocommerce-orders-tracking' ); ?></li>
                    <li><?php echo wp_kses_post( __( '<strong>*Caution:</strong> sandbox API CANNOT be used for orders created in live environment and vice versa.',
							'woocommerce-orders-tracking' ) ) ?></li>
                </ul>
            </div>
            <table class="vi-ui celled small table wot-paypal-app-table">
                <thead>
                <tr class="wot-paypal-app-table-header">
                    <th><?php esc_html_e( 'Payment Method', 'woocommerce-orders-tracking' ) ?></th>
                    <th><?php esc_html_e( 'Is sandbox', 'woocommerce-orders-tracking' ) ?></th>
                    <th><?php esc_html_e( 'Client ID', 'woocommerce-orders-tracking' ) ?></th>
                    <th><?php esc_html_e( 'Client Secret', 'woocommerce-orders-tracking' ) ?></th>
                    <th><?php esc_html_e( 'Action', 'woocommerce-orders-tracking' ) ?></th>
                </tr>
                </thead>
                <tbody>
				<?php
				$paypal_method = $this->settings->get_params( 'paypal_method' );
				foreach ( $available_paypal_methods as $item ) {
					$i              = array_search( $item->id, $paypal_method );
					$live_client_id = $live_client_secret = $sandbox_client_id = $sandbox_client_secret = $sandbox_enable = $disabled = '';
					if ( is_numeric( $i ) ) {
						$live_client_id        = $this->settings->get_params( 'paypal_client_id_live' )[ $i ];
						$live_client_secret    = $this->settings->get_params( 'paypal_secret_live' )[ $i ];
						$sandbox_client_id     = $this->settings->get_params( 'paypal_client_id_sandbox' )[ $i ];
						$sandbox_client_secret = $this->settings->get_params( 'paypal_secret_sandbox' )[ $i ];
						$sandbox_enable        = $this->settings->get_params( 'paypal_sandbox_enable' )[ $i ];
					}
					if ( $item->id === 'default' ) {
						$disabled       = 'disabled';
						$sandbox_enable = '';
					} elseif ( $item->id === 'default_sandbox' ) {
						$disabled       = 'disabled';
						$sandbox_enable = 1;
					}
					?>
                    <tr class="wot-paypal-app-content">
                        <td>
                            <input type="hidden"
                                   name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[paypal][paypal_method][]"
                                   value="<?php echo esc_attr( $item->id ) ?>">
                            <input type="text" title="<?php echo esc_attr( $item->id ) ?>"
                                   value="<?php echo esc_attr( $item->method_title ) ?>" readonly>
                        </td>
                        <td>
                            <input type="hidden"
                                   name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[paypal][paypal_sandbox_enable][]"
                                   class="<?php echo esc_attr( self::set( 'setting-paypal-sandbox-enable' ) ) ?>"
                                   value="<?php echo esc_attr( $sandbox_enable ); ?>">
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox"
                                       class="<?php echo esc_attr( self::set( 'setting-paypal-sandbox-enable-checkbox' ) ) ?>"
                                       value="<?php echo esc_attr( $sandbox_enable ); ?>" <?php echo esc_attr( $disabled ); ?> <?php checked( $sandbox_enable, '1' ) ?> >
                            </div>
                        </td>
                        <td>
                            <div class="field">
                                <div class="field  woo-orders-tracking-setting-paypal-live-wrap">
                                    <div class="vi-ui input"
                                         data-tooltip="<?php echo esc_attr__( 'Live Client ID', 'woocommerce-orders-tracking' ) ?>">
                                        <input type="text"
                                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[paypal][paypal_client_id_live][]"
                                               class="woo-orders-tracking-setting-paypal-client-id-live"
                                               value="<?php echo esc_attr( $live_client_id ) ?>">
                                    </div>
                                </div>
                                <div class="field woo-orders-tracking-setting-paypal-sandbox-wrap">
                                    <div class="vi-ui input"
                                         data-tooltip="<?php echo esc_attr__( 'Sandbox Client ID', 'woocommerce-orders-tracking' ) ?>">
                                        <input type="text"
                                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[paypal][paypal_client_id_sandbox][]"
                                               class="woo-orders-tracking-setting-paypal-client-id-sandbox"
                                               value="<?php echo esc_attr( $sandbox_client_id ) ?>">
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="field ">
                                <div class="field  woo-orders-tracking-setting-paypal-live-wrap">
                                    <div class="vi-ui input"
                                         data-tooltip="<?php echo esc_attr__( 'Live Client Secret', 'woocommerce-orders-tracking' ) ?>">
                                        <input type="text"
                                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[paypal][paypal_secret_live][]"
                                               class="woo-orders-tracking-setting-paypal-secret-live"
                                               value="<?php echo esc_attr( $live_client_secret ) ?>">
                                    </div>
                                </div>
                                <div class="field woo-orders-tracking-setting-paypal-sandbox-wrap">
                                    <div class="vi-ui input"
                                         data-tooltip="<?php echo esc_attr__( 'Sandbox Client Secret', 'woocommerce-orders-tracking' ) ?>">
                                        <input type="text"
                                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[paypal][paypal_secret_sandbox][]"
                                               class="woo-orders-tracking-setting-paypal-secret-sandbox"
                                               value="<?php echo esc_attr( $sandbox_client_secret ) ?>">
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="field">
                                <div class="field">
                                        <span class="wot-paypal-app-content-action-test-api wot-paypal-app-content-action-btn vi-ui button tiny">
                                    <?php esc_html_e( 'Test Connection', 'woocommerce-orders-tracking' ) ?>
                                </span>
                                </div>
                                <div class="field">
                                    <div class="<?php echo esc_attr( self::set( 'setting-paypal-btn-check-api-text' ) ) ?>">
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
					<?php
				}
				?>
                </tbody>
            </table>
            <table class="form-table">
                <tbody>
                <tr>
                    <th>
                        <label for="<?php echo esc_attr( self::set( 'paypal_debug' ) ) ?>"><?php esc_html_e( 'Debug', 'woocommerce-orders-tracking' ) ?></label>
                    </th>
                    <td>
                        <div class="vi-ui toggle checkbox">
                            <input type="checkbox"
                                   name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[paypal][paypal_debug]"
                                   id="<?php echo esc_attr( self::set( 'paypal_debug' ) ) ?>"
                                   value="1" <?php checked( $this->settings->get_params( 'paypal_debug' ), '1' ) ?>><label></label>
                        </div>
                        <p class="description"><?php esc_html_e( 'If enabled, raw request to PayPal API will be logged whenever there\'s an error',
								'woocommerce-orders-tracking' ) ?></p>
                    </td>
                </tr>
                </tbody>
            </table>
			<?php
		} else {
			?>
            <div class="vi-ui negative message">
                <div class="header">
					<?php esc_html_e( 'This option will only be available if a PayPal payment method is activated', 'woocommerce-orders-tracking' ) ?>
                </div>
            </div>
			<?php
		}
	}

	private function advanced_settings() {
		?>
        <div class="vi-ui positive small message">
            <div class="header"><?php esc_html_e( 'Manage required user capability to be able to change settings or use plugin', 'woocommerce-orders-tracking' ); ?></div>
            <ul class="list">
                <li><?php esc_html_e( 'Only Administrators can access Advanced Settings and Update tab', 'woocommerce-orders-tracking' ); ?></li>
                <li><?php esc_html_e( 'manage_options = only Administrators can access', 'woocommerce-orders-tracking' ); ?></li>
                <li><?php esc_html_e( 'manage_woocommerce = both Administrators and Shop managers can access', 'woocommerce-orders-tracking' ); ?></li>
            </ul>
        </div>
        <table class="form-table">
            <tbody>
			<?php
			$capabilities = $this->settings->get_params( 'capabilities' );
			foreach ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_functionality() as $key => $value ) {
				$get_capabilities = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_capabilities( $key );
				$capability       = isset( $capabilities[ $key ] ) ? $capabilities[ $key ] : '';
				?>
                <tr>
                    <th><?php echo esc_html( $value ) ?></th>
                    <td>
                        <select name="<?php echo esc_attr( self::set( "settings[capabilities][$key]" ) ) ?>"
                                id="<?php echo esc_attr( self::set( "capability-$key" ) ) ?>"
                                class="vi-ui dropdown <?php echo esc_attr( self::set( "capability-$key" ) ) ?>">
							<?php
							foreach ( $get_capabilities as $get_capability ) {
								?>
                                <option value="<?php echo esc_attr( $get_capability ) ?>" <?php selected( $capability,
									$get_capability ) ?>><?php echo esc_html( $get_capability ) ?></option>
								<?php
							}
							?>
                        </select>
                    </td>
                </tr>
				<?php
			}
			?>
            </tbody>
        </table>
		<?php
	}

	private function tracking_service_settings() {
		$all_order_statuses = wc_get_order_statuses();
		?>
        <div class="vi-ui positive small message">
            <div class="header"><?php esc_html_e( 'Shortcode', 'woocommerce-orders-tracking' ); ?></div>
            <ul class="list">
                <li><?php echo VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_kses_post( sprintf( __( 'Branded tracking form shortcode %s. This only works if you use a tracking service. By default, tracking form is appended to the tracking page. If you want to change the tracking form\'s position, especially when the tracking page is built with an UX builder, this shortcode is very helpful.',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment, WordPress.Security.EscapeOutput.OutputNotEscaped
						'woocommerce-orders-tracking' ), '<span data-tooltip="' . esc_attr__( 'Click to copy', 'woocommerce-orders-tracking' )
				                                         . '"><input type="text" class="wot-input-shortcode-field" readonly value="[vi_wot_form_track_order]"></span>' ) ) ?></li>
                <li><?php echo VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_kses_post( sprintf( __( 'TrackingMore tracking form shortcode %s. You can still use this shortcode even if you do not use tracking service. More details about this at <a target="_blank" href="https://www.trackingmore.com/embed_box_float-en.html">Track Button</a>',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment, WordPress.Security.EscapeOutput.OutputNotEscaped
						'woocommerce-orders-tracking' ), '<span data-tooltip="' . esc_attr__( 'Click to copy', 'woocommerce-orders-tracking' )
				                                         . '"><input type="text" class="wot-input-shortcode-field" readonly value="[vi_wot_tracking_more_form]"></span>' ) ) ?></li>
            </ul>
        </div>
        <table class="form-table">
            <tbody>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-service-carrier-enable' ) ) ?>">
						<?php esc_html_e( 'Enable', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[service_carrier][service_carrier_enable]"
                               id="<?php echo esc_attr( self::set( 'setting-service-carrier-enable' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'service_carrier_enable' ), '1' ) ?>><label
                                for="<?php echo esc_attr( self::set( 'setting-service-carrier-enable' ) ) ?>"><?php esc_html_e( 'Yes', 'woocommerce-orders-tracking' ); ?></label>
                    </div>
                    <p class="description"><?php esc_html_e( 'If disabled, tracking url will be a shipping carrier\'s own tracking page.', 'woocommerce-orders-tracking' ) ?></p>
                    <p class="description"><?php esc_html_e( 'If enabled, tracking url will be your "Tracking page" if set and will be the selected tracking service\'s tracking page otherwise.',
							'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
			<?php
			$api_key_class        = array( 'tracking-service-api' );
			$service_carrier_type = $this->settings->get_params( 'service_carrier_type' );
			if ( $service_carrier_type === 'cainiao' ) {
				$api_key_class[] = 'hidden';
			}
			$service_carriers_list = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::service_carriers_list();
			?>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-service-carrier-type' ) ) ?>"><?php esc_html_e( 'Service', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <select name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[service_carrier][service_carrier_type]"
                            id="<?php echo esc_attr( self::set( 'setting-service-carrier-type' ) ) ?>"
                            class="vi-ui dropdown <?php echo esc_attr( self::set( 'setting-service-carrier-type' ) ) ?>">
						<?php
						foreach ( $service_carriers_list as $item_slug => $item ) {
							$item_name = $item['name'] ?? $item_slug;
							switch ( $item['status'] ?? '' ) {
								case 'beta':
									$item_name .= esc_html__( ' - Beta', 'woo-orders-tracking' );
									break;
							}
							?>
                            <option value="<?php echo esc_attr( $item_slug ) ?>" <?php selected( $service_carrier_type,
								$item_slug ) ?>><?php echo esc_html( $item_name ); ?></option>
							<?php
						}
						?>
                    </select>
                    <p class="description"><?php esc_html_e( 'As Cainiao does not support API, it\'s unstable to use.', 'woocommerce-orders-tracking' ) ?></p>
                    <p class="description"><?php echo wp_kses_post( __( '<strong>Notice</strong>: for some tracking services, API access is NOT available for a free plan.',
							'woocommerce-orders-tracking' ) ) ?></p>
                </td>
            </tr>

            <tr class="<?php echo esc_attr( self::set( $api_key_class ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-service-carrier-api-key' ) ) ?>">
						<?php esc_html_e( 'API key', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[service_carrier][service_carrier_api_key]"
                           id="<?php echo esc_attr( self::set( 'setting-service-carrier-api-key' ) ) ?>"
                           value="<?php echo esc_attr( $this->settings->get_params( 'service_carrier_api_key' ) ) ?>">
					<?php
					foreach ( $service_carriers_list as $item_slug => $item ) {
						$disabled    = ( $item['status'] ?? '' ) === 'disabled';
						$get_key_url = $item['get_key_url'] ?? '';
						if ( $disabled || ! $get_key_url ) {
							continue;
						}
						$item_name = $item['name'] ?? $item_slug;
						?>
                        <p class="description <?php echo esc_attr( self::set( array(
							'setting-service-carrier-api-key-' . $item_slug,
							'setting-service-carrier-api-key',
							'hidden'
						) ) ) ?>">
							<?php
							echo wp_kses_post( sprintf( __( 'Please enter your %s api key. If you don\'t have an account, <a href="%s" target="_blank"><strong>click here</strong></a> to create one and generate api key', 'woocommerce-orders-tracking' ), $item_name, $get_key_url ) );
							?>
                        </p>
						<?php
					}
					?>
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $api_key_class ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-service-add-tracking-if-not-exist' ) ) ?>">
						<?php esc_html_e( 'Add tracking if not exist', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[service_carrier][service_add_tracking_if_not_exist]"
                               id="<?php echo esc_attr( self::set( 'setting-service-add-tracking-if-not-exist' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'service_add_tracking_if_not_exist' ), '1' ) ?>><label
                                for="<?php echo esc_attr( self::set( 'setting-service-add-tracking-if-not-exist' ) ) ?>"><?php esc_html_e( 'Yes',
								'woocommerce-orders-tracking' ); ?></label>
                    </div>
                    <p class="description"><?php esc_html_e( 'When customers search for a tracking number that exists in your current orders, add it to your tracking API if it does not exist in your API tracking list',
							'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-service-timeline_ajax' ) ) ?>">
						<?php esc_html_e( 'Timeline AJAX', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[service_carrier][timeline_ajax]"
                               id="<?php echo esc_attr( self::set( 'setting-service-timeline_ajax' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'timeline_ajax' ), '1' ) ?>><label
                                for="<?php echo esc_attr( self::set( 'setting-service-timeline_ajax' ) ) ?>"><?php esc_html_e( 'Yes',
								'woocommerce-orders-tracking' ); ?></label>
                    </div>
                    <p class="description"><?php esc_html_e( 'Get timeline information via AJAX', 'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
			<?php
			$service_tracking_page = $this->settings->get_params( 'service_tracking_page' );
			?>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'setting-service-tracking-page' ) ) ?>">
						<?php
						esc_html_e( 'Tracking page', 'woocommerce-orders-tracking' );
						?>
                    </label>
                </th>
                <td>
                    <select name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[service_carrier][service_tracking_page]"
                            id="<?php echo esc_attr( self::set( 'setting-service-tracking-page' ) ) ?>"
                            class="search-page <?php echo esc_attr( self::set( 'setting-service-tracking-page' ) ) ?>">
						<?php
						if ( $service_tracking_page ) {
							?>
                            <option value="<?php echo esc_attr( $service_tracking_page ) ?>"
                                    selected><?php echo esc_html( get_the_title( $service_tracking_page ) ) ?></option>
							<?php
						}
						?>
                    </select>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="setting-service-carrier-default">
						<?php esc_html_e( 'Customize Tracking page', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <div>
						<?php
						if ( $service_tracking_page && $service_tracking_page_url = get_the_permalink( $service_tracking_page ) ) {
							$href = 'customize.php?url=' . urlencode( $service_tracking_page_url ) . '&autofocus[panel]=vi_wot_orders_tracking_design';
							?>
                            <a href="<?php echo esc_url( $href ) ?>"
                               target="_blank">
								<?php esc_html_e( 'Click to customize your tracking page', 'woocommerce-orders-tracking' ) ?>
                            </a>
							<?php
						} else {
							?>
                            <label for="<?php echo esc_attr( self::set( 'setting-service-tracking-page' ) ) ?>"><?php esc_html_e( 'Please select a Tracking page and save settings to use this feature',
									'woocommerce-orders-tracking' ); ?></label>
							<?php
						}
						?>
                    </div>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'service_cache_request' ) ) ?>">
						<?php
						esc_html_e( 'Cache request', 'woocommerce-orders-tracking' );
						?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui right labeled input">
                        <input type="number" min="0" step="0.5"
                               class="<?php echo esc_attr( self::set( 'service_cache_request' ) ) ?>"
                               id="<?php echo esc_attr( self::set( 'service_cache_request' ) ) ?>"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[service_carrier][service_cache_request]"
                               value="<?php echo esc_attr( $this->settings->get_params( 'service_cache_request' ) ) ?>">
                        <label for="<?php echo esc_attr( self::set( 'service_cache_request' ) ) ?>"
                               class="vi-ui label"><?php esc_html_e( 'Hour(s)', 'woocommerce-orders-tracking' ) ?></label>
                    </div>
                    <p class="description"><?php esc_html_e( 'When customers search for a tracking number on tracking page, the result will be saved to use for same searches for this tracking number within this cache time',
							'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
            <tr class="<?php echo esc_attr( self::set( $api_key_class ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'change_order_status' ) ) ?>"><?php esc_html_e( 'Change Order Status', 'woocommerce-orders-tracking' ) ?></label>
                </th>
                <td>
					<?php
					$change_order_status         = $this->settings->get_params( 'change_order_status' );
					$change_order_exclude_status = (array) $this->settings->get_params( 'change_order_exclude_status' );
					?>
                    <select id="<?php echo esc_attr( self::set( 'change_order_status' ) ) ?>"
                            class="vi-ui dropdown"
                            name="<?php echo esc_attr( self::set( 'change_order_status', true ) ) ?>">
                        <option value=""><?php esc_html_e( 'Not change', 'woocommerce-orders-tracking' ) ?></option>
						<?php
						foreach ( $all_order_statuses as $all_option_k => $all_option_v ) {
							?>
                            <option value="<?php echo esc_attr( $all_option_k ) ?>" <?php selected( $all_option_k,
								$change_order_status ) ?>><?php echo esc_html( $all_option_v ) ?></option>
							<?php
						}
						?>
                    </select>
                    <p class="description"><?php esc_html_e( 'Select order status to change to when Shipment status changes to Delivered.', 'woocommerce-orders-tracking' ) ?></p>
                    <select id="<?php echo esc_attr( self::set( 'change_order_exclude_status' ) ) ?>"
                            class="vi-ui fluid dropdown"
                            name="<?php echo esc_attr( self::set( 'change_order_exclude_status', true ) ) ?>[]" multiple>
						<?php
						foreach ( $all_order_statuses as $all_option_k => $all_option_v ) {
							?>
                            <option value="<?php echo esc_attr( $all_option_k ) ?>" <?php selected( in_array( $all_option_k, $change_order_exclude_status ), true ) ?>><?php echo esc_html( $all_option_v ) ?></option>
							<?php
						}
						?>
                    </select>
                    <p class="description"><?php esc_html_e( 'Select order status to exclude to change order status when Shipment status changes to Delivered. Leave it blank if you don\'t want to change order status',
							'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
			<?php do_action( 'woo_orders_tracking_settings_after_change_order_status' ); ?>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'translate_timeline' ) ) ?>">
						<?php esc_html_e( 'Translate timeline', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
					<?php
					$translate_timeline = $this->settings->get_params( 'translate_timeline' );
					?>
                    <select class="vi-ui dropdown"
                            name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[translate_timeline]"
                            id="<?php echo esc_attr( self::set( 'translate_timeline' ) ) ?>">
                        <option value=""><?php esc_html_e( 'Not translate', 'woocommerce-orders-tracking' ); ?></option>
                        <option value="site_language" <?php selected( $translate_timeline, 'site_language' ) ?>><?php esc_html_e( 'Site language',
								'woocommerce-orders-tracking' ); ?></option>
                        <option value="english" <?php selected( $translate_timeline, 'english' ) ?>><?php esc_html_e( 'English', 'woocommerce-orders-tracking' ); ?></option>
						<?php
						if ( count( $this->languages ) ) {
							?>
                            <option value="wpml" <?php selected( $translate_timeline, 'wpml' ) ?>><?php esc_html_e( 'WPML', 'woocommerce-orders-tracking' ); ?></option>
							<?php
						}
						?>
                    </select>
                    <p class="description"><?php echo wp_kses_post( sprintf( __( 'Using <a target="_blank" href="%s">Google Cloud Translation API</a> to translate timeline to a specific language',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
							'woocommerce-orders-tracking' ), 'https://cloud.google.com/translate/docs/basic/translating-text' ) ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'cloud_translation_api' ) ) ?>">
						<?php esc_html_e( 'Cloud Translation API key', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[cloud_translation_api]"
                           id="<?php echo esc_attr( self::set( 'cloud_translation_api' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'cloud_translation_api' ) ) ) ?>">
                    <p class="description"><?php echo wp_kses_post( sprintf( __( 'This functionality uses Cloud Translation - Basic API, please click <a target="_blank" href="%s">here</a> to read more about pricing',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
							'woocommerce-orders-tracking' ), 'https://cloud.google.com/translate/pricing#cloud-translation---basic' ) ) ?></p>
                    <p class="description"><?php echo wp_kses_post( sprintf( __( 'To get API key, please read <a target="_blank" href="%s">https://cloud.google.com/docs/authentication/api-keys#creating_an_api_key</a> or watch our guiding video below',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
							'woocommerce-orders-tracking' ), 'https://cloud.google.com/docs/authentication/api-keys#creating_an_api_key' ) ) ?></p>
                    <div class="vi-ui accordion segment">
                        <div class="title"><i
                                    class="dropdown icon"></i><?php esc_html_e( 'How to get Google Cloud Translation API key?', 'woocommerce-orders-tracking' ) ?>
                        </div>
                        <div class="content">
                            <iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/fHLIVGcXXNM"
                                    title="YouTube video player" frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowfullscreen></iframe>
                        </div>
                    </div>
                </td>
            </tr>
            </tbody>
        </table>
        <div class="vi-ui positive small message">
            <div class="header">
				<?php esc_html_e( 'Default track info', 'woocommerce-orders-tracking' ) ?>
            </div>
            <ul class="list">
                <li><?php esc_html_e( 'This feature is to reduce after-purchase support for new orders when tracking number is not available, or available but without any info',
						'woocommerce-orders-tracking' ) ?></li>
                <li><?php esc_html_e( 'Row with empty description will not show on the tracking page', 'woocommerce-orders-tracking' ) ?></li>
                <li><?php esc_html_e( 'Time is relative to an order\'s created time', 'woocommerce-orders-tracking' ) ?></li>
                <li><?php esc_html_e( 'Tracking service must be enabled and tracking page must be set', 'woocommerce-orders-tracking' ) ?></li>
            </ul>
        </div>
        <table class="vi-ui form-table">
            <tbody>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'default_track_info_enable' ) ) ?>">
						<?php esc_html_e( 'Show default track info', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_enable]"
                               id="<?php echo esc_attr( self::set( 'default_track_info_enable' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'default_track_info_enable' ), '1' ) ?>>
                    </div>
                    <p class="description"><?php esc_html_e( 'Show below track info in tracking timeline if a real tracking number does not have any information from tracking service',
							'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'default_track_info_carrier' ) ) ?>">
						<?php esc_html_e( 'Default carrier name', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_carrier]"
                           id="<?php echo esc_attr( self::set( 'default_track_info_carrier' ) ) ?>"
                           value="<?php echo esc_attr( $this->settings->get_params( 'default_track_info_carrier' ) ) ?>">
                    <p class="description"><?php esc_html_e( 'The carrier which will show for the default track info', 'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
            </tbody>
        </table>
        <table class="vi-ui celled table <?php echo esc_attr( self::set( 'default-track-info-table' ) ) ?>">
            <thead>
            <tr>
                <th style="width: 1%"><?php esc_html_e( 'No.', 'woocommerce-orders-tracking' ) ?></th>
                <th><?php esc_html_e( 'Show if order status', 'woocommerce-orders-tracking' ) ?></th>
                <th><?php esc_html_e( 'Time(since order created)', 'woocommerce-orders-tracking' ) ?></th>
                <th style="width: 1%"><?php esc_html_e( 'Status', 'woocommerce-orders-tracking' ) ?></th>
                <th><?php esc_html_e( 'Description', 'woocommerce-orders-tracking' ) ?></th>
                <th style="width: 1%"></th>
            </tr>
            </thead>
            <tbody>
			<?php
			$ft_messages = $this->settings->get_params( 'default_track_info_message' );
			if ( ! is_array( $ft_messages ) || ! count( $ft_messages ) ) {
				$ft_messages = array(
					array(
						'time'        => 0,
						'description' => '',
						'location'    => '',
						'status'      => 'pending',
					)
				);
			}
			$ft_message_no = 1;
			foreach ( $ft_messages as $ft_message ) {
				?>
                <tr class="<?php echo esc_attr( self::set( 'ft-row' ) ) ?>">
                    <td class="<?php echo esc_attr( self::set( 'ft-message-no-td' ) ) ?>"><span
                                class="<?php echo esc_attr( self::set( 'ft-message-no' ) ) ?>"><?php echo esc_html( $ft_message_no ); ?></span>
                    </td>
                    <td>
                        <select class="vi-ui fluid dropdown <?php echo esc_attr( self::set( 'ft-message-order-statuses' ) ) ?>"
                                multiple>
							<?php
							foreach ( $all_order_statuses as $all_option_k => $all_option_v ) {
								?>
                                <option value="<?php echo esc_attr( $all_option_k ) ?>" <?php if ( in_array( $all_option_k, $ft_message['order_statuses'] ) ) {
									echo esc_attr( 'selected' );
								} ?>><?php echo esc_html( $all_option_v ) ?></option>
								<?php
							}
							?>
                        </select>
                        <input type="hidden"
                               class="<?php echo esc_attr( self::set( 'ft-message-order-statuses-value' ) ) ?>"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_message][order_statuses][]"
                               value="<?php echo esc_attr( vi_wot_json_encode( $ft_message['order_statuses'] ) ) ?>">
                    </td>
                    <td class="<?php echo esc_attr( self::set( 'ft-message-time-td' ) ) ?>">
						<?php
						$day = $hour = $min = $sec = 0;
						if ( $ft_message['time'] > 0 ) {
							$time = $ft_message['time'];
							$day  = floor( $time / DAY_IN_SECONDS );
							$time = $time - $day * DAY_IN_SECONDS;
							$hour = floor( $time / HOUR_IN_SECONDS );
							$time = $time - $hour * HOUR_IN_SECONDS;
							$min  = floor( $time / MINUTE_IN_SECONDS );
						}
						?>
                        <div class="vi-ui equal width fields">
                            <div class="vi-ui right labeled input fluid field mini">
                                <input type="number" min="0"
                                       class="<?php echo esc_attr( self::set( 'ft-message-time-day' ) ) ?>"
                                       name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_message][day][]"
                                       value="<?php echo esc_attr( $day ) ?>">
                                <label for="amount"
                                       class="vi-ui label"><?php esc_html_e( 'Day', 'woocommerce-orders-tracking' ) ?></label>
                            </div>
                            <div class="vi-ui right labeled input fluid field mini">
                                <input type="number" min="0" max="23"
                                       class="<?php echo esc_attr( self::set( 'ft-message-time-hour' ) ) ?>"
                                       name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_message][hour][]"
                                       value="<?php echo esc_attr( $hour ) ?>">
                                <label for="amount"
                                       class="vi-ui label"><?php esc_html_e( 'Hour', 'woocommerce-orders-tracking' ) ?></label>
                            </div>
                            <div class="vi-ui right labeled input fluid field mini">
                                <input type="number" min="0" max="59"
                                       class="<?php echo esc_attr( self::set( 'ft-message-time-minute' ) ) ?>"
                                       name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_message][minute][]"
                                       value="<?php echo esc_attr( $min ) ?>">
                                <label for="amount"
                                       class="vi-ui label"><?php esc_html_e( 'Minute', 'woocommerce-orders-tracking' ) ?></label>
                            </div>
                        </div>
                    </td>
                    <td>
						<?php
						$statuses = array(
							'pending' => esc_html__( 'Pending', 'woocommerce-orders-tracking' ),
							'transit' => esc_html__( 'In Transit', 'woocommerce-orders-tracking' ),
							'pickup'  => esc_html__( 'Pickup', 'woocommerce-orders-tracking' ),
						);
						?>
                        <select class="vi-ui dropdown"
                                name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_message][status][]">
							<?php
							foreach ( $statuses as $status_k => $status_v ) {
								?>
                                <option value="<?php echo esc_attr( $status_k ) ?>" <?php selected( $status_k, $ft_message['status'] ) ?>><?php echo wp_kses_post( $status_v ) ?></option>
								<?php
							}
							?>
                        </select>
                    </td>
                    <td>
                        <input type="text"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_message][description][]"
                               value="<?php echo esc_attr( $ft_message['description'] ) ?>">
                    </td>
                    <td>
                        <div>
                            <span class="vi-ui button icon negative mini <?php echo esc_attr( self::set( 'ft-button-remove' ) ) ?>"
                                  title="<?php esc_attr_e( 'Remove', 'woocommerce-orders-tracking' ) ?>"><i
                                        class="icon trash"></i></span>
                        </div>
                    </td>
                </tr>
				<?php
				$ft_message_no ++;
			}
			?>
            </tbody>
            <tfoot>
            <tr>
                <th colspan="6">
                    <div>
                        <span class="vi-ui button icon positive mini <?php echo esc_attr( self::set( 'ft-button-add' ) ) ?>"
                              title="<?php esc_attr_e( 'Add', 'woocommerce-orders-tracking' ) ?>"><i
                                    class="icon add"></i></span>
                    </div>
                </th>
            </tr>
            </tfoot>
        </table>
        <table class="form-table">
            <tbody>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'default_track_info_number' ) ) ?>">
						<?php esc_html_e( 'Default tracking number', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_number]"
                               id="<?php echo esc_attr( self::set( 'default_track_info_number' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'default_track_info_number' ), '1' ) ?>>
                    </div>
                    <p class="description"><?php echo wp_kses_post( __( 'If an order does not have a tracking number, default tracking number will be displayed on Order received page, My account/orders and in emails that you configure in <a href="#email_woo">WooCommerce Email tab</a>.',
							'woocommerce-orders-tracking' ) ) ?></p>
                    <p class="description"><?php esc_html_e( 'When a customer uses a "default tracking number" to track, the default track info will be used.',
							'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'default_track_info_content' ) ) ?>">
						<?php esc_html_e( 'Content', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
					<?php
					$this->default_language_flag_html( 'default_track_info_content' );
					wp_editor( stripslashes( $this->settings->get_params( 'default_track_info_content' ) ), 'default-track-info-content', array(
						'editor_height' => 150,
						'textarea_name' => 'woo-orders-tracking-settings[default_track_info_content]'
					) );
					if ( count( $this->languages ) ) {
						foreach ( $this->languages as $key => $value ) {
							?>
                            <p>
                                <label for="<?php echo esc_attr( "default-track-info-content_{$value}" ) ?>"><?php
									if ( isset( $this->languages_data[ $value ]['country_flag_url'] ) && $this->languages_data[ $value ]['country_flag_url'] ) {
										?>
                                        <img src="<?php echo esc_url( $this->languages_data[ $value ]['country_flag_url'] ); ?>">
										<?php
									}
									echo wp_kses_post( $value );
									if ( isset( $this->languages_data[ $value ]['translated_name'] ) ) {
										echo wp_kses_post( '(' . $this->languages_data[ $value ]['translated_name'] . ')' );
									}
									?>:</label>
                            </p>
							<?php
							wp_editor( stripslashes( $this->settings->get_params( 'default_track_info_content', '', $value ) ), "default-track-info-content_{$value}", array(
								'editor_height' => 150,
								'textarea_name' => "woo-orders-tracking-settings[default_track_info_content_{$value}]"
							) );
						}
					}
					?>
                    <p class="description"><?php esc_html_e( 'Message including default tracking number which will be displayed on Order received page or WooCommerce email.',
							'woocommerce-orders-tracking' ) ?></p>
					<?php
					self::table_of_placeholders(
						array(
							'tracking_number' => esc_html__( 'Default tracking number', 'woocommerce-orders-tracking' ),
							'tracking_url'    => esc_html__( 'Tracking url', 'woocommerce-orders-tracking' ),
						)
					);
					?>
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'default_track_info_position' ) ) ?>">
						<?php esc_html_e( 'Position', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
					<?php
					$default_position = $this->settings->get_params( 'default_track_info_position' );
					?>
                    <select class="vi-ui dropdown"
                            name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[default_track_info_position]"
                            id="<?php echo esc_attr( self::set( 'default_track_info_position' ) ) ?>">
                        <option value="before_order_table" <?php selected( $default_position, 'before_order_table' ) ?>><?php esc_html_e( 'Before order table',
								'woocommerce-orders-tracking' ); ?></option>
                        <option value="after_order_table" <?php selected( $default_position, 'after_order_table' ) ?>><?php esc_html_e( 'After order table',
								'woocommerce-orders-tracking' ); ?></option>
                    </select>
                    <p class="description"><?php esc_html_e( 'Position of the default tracking number message on order received page', 'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
            </tbody>
        </table>
        <div class="vi-ui positive small message">
            <div class="header">
				<?php esc_html_e( 'Google reCAPTCHA for tracking form', 'woocommerce-orders-tracking' ) ?>
            </div>
            <ul class="list">
                <li><?php echo wp_kses_post( __( 'Visit <a target="_blank" href="http://www.google.com/recaptcha/admin">Google reCAPTCHA page</a> to sign up for an API key pair with your Gmail account',
						'woocommerce-orders-tracking' ) ) ?></li>
                <li><?php esc_html_e( 'Select the reCAPTCHA version that you want to use', 'woocommerce-orders-tracking' ) ?></li>
                <li><?php esc_html_e( 'Fill in authorized domains', 'woocommerce-orders-tracking' ) ?></li>
                <li><?php esc_html_e( 'Accept terms of service and click Register button', 'woocommerce-orders-tracking' ) ?></li>
                <li><?php esc_html_e( 'Copy and paste the site key and secret key into respective fields', 'woocommerce-orders-tracking' ) ?></li>
            </ul>
        </div>
        <table class="form-table">
            <tbody>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_enable' ) ) ?>">
						<?php esc_html_e( 'Enable reCAPTCHA', 'woocommerce-orders-tracking' ); ?>
                    </label>
                </th>
                <td>
                    <div class="vi-ui toggle checkbox">
                        <input type="checkbox"
                               name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[tracking_form_recaptcha_enable]"
                               id="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_enable' ) ) ?>"
                               value="1" <?php checked( $this->settings->get_params( 'tracking_form_recaptcha_enable' ), '1' ) ?>>
                    </div>
                    <p class="description"><?php esc_html_e( 'Use Google reCAPTCHA for tracking form', 'woocommerce-orders-tracking' ) ?></p>
                </td>
            </tr>
			<?php
			$recaptcha_version = $this->settings->get_params( 'tracking_form_recaptcha_version' );
			?>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_version' ) ) ?>">
						<?php esc_html_e( 'reCAPTCHA version', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <select class="vi-ui dropdown"
                            name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[tracking_form_recaptcha_version]"
                            id="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_version' ) ) ?>">
                        <option value="2" <?php selected( $recaptcha_version, 2 ) ?>><?php esc_html_e( 'reCAPTCHA V2', 'woocommerce-orders-tracking' ) ?></option>
                        <option value="3" <?php selected( $recaptcha_version, 3 ) ?>><?php esc_html_e( 'reCAPTCHA V3', 'woocommerce-orders-tracking' ) ?></option>
                    </select>
                </td>
            </tr>

            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_site_key' ) ) ?>">
						<?php esc_html_e( 'Site key', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[tracking_form_recaptcha_site_key]"
                           id="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_site_key' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'tracking_form_recaptcha_site_key' ) ) ) ?>">
                </td>
            </tr>
            <tr>
                <th>
                    <label for="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_secret_key' ) ) ?>">
						<?php esc_html_e( 'Secret key', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <input type="text"
                           name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[tracking_form_recaptcha_secret_key]"
                           id="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_secret_key' ) ) ?>"
                           value="<?php echo esc_attr( htmlentities( $this->settings->get_params( 'tracking_form_recaptcha_secret_key' ) ) ) ?>">
                </td>
            </tr>
			<?php
			$recaptcha_theme = $this->settings->get_params( 'tracking_form_recaptcha_theme' );
			?>
            <tr class="<?php echo esc_attr( $recaptcha_version == 2 ? '' : self::set( 'hidden' ) ) ?>">
                <th>
                    <label for="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_theme' ) ) ?>">
						<?php esc_html_e( 'Theme', 'woocommerce-orders-tracking' ) ?>
                    </label>
                </th>
                <td>
                    <select class="vi-ui dropdown"
                            name="<?php echo esc_attr( self::set( 'settings' ) ) ?>[tracking_form_recaptcha_theme]"
                            id="<?php echo esc_attr( self::set( 'tracking_form_recaptcha_theme' ) ) ?>">
                        <option value="dark" <?php selected( $recaptcha_theme, 'dark' ) ?>><?php esc_html_e( 'Dark', 'woocommerce-orders-tracking' ) ?></option>
                        <option value="light" <?php selected( $recaptcha_theme, 'light' ) ?>><?php esc_html_e( 'Light', 'woocommerce-orders-tracking' ) ?></option>
                    </select>
                </td>
            </tr>
            </tbody>
        </table>
		<?php
	}

	public function default_language_flag_html( $name = '' ) {
		if ( $this->default_language ) {
			?>
            <p>
                <label for="<?php echo esc_attr( self::set( $name ) ) ?>"><?php
					if ( isset( $this->languages_data[ $this->default_language ]['country_flag_url'] ) && $this->languages_data[ $this->default_language ]['country_flag_url'] ) {
						?>
                        <img src="<?php echo esc_url( $this->languages_data[ $this->default_language ]['country_flag_url'] ); ?>">
						<?php
					}
					echo wp_kses_post( $this->default_language );
					if ( isset( $this->languages_data[ $this->default_language ]['translated_name'] ) ) {
						echo wp_kses_post( '(' . $this->languages_data[ $this->default_language ]['translated_name'] . '):' );
					}
					?></label>
            </p>
			<?php
		}
	}

	public function wotv_admin_delete_shipping_carrier() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		if ( ! isset( $_POST['action_nonce'] ) || ! wp_verify_nonce( $_POST['action_nonce'], 'vi_wot_setting_action_nonce' ) ) {
			return;
		}
		$carrier_slug = isset( $_POST['carrier_slug'] ) ? sanitize_text_field( $_POST['carrier_slug'] ) : '';
		if ( $carrier_slug ) {
			$args     = $this->settings->get_params();
			$position = '';
			$carriers = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_custom_carriers();
			if ( count( $carriers ) ) {
				foreach ( $carriers as $shipping_carrier ) {
					if ( $shipping_carrier["slug"] === $carrier_slug ) {
						$position = array_search( $shipping_carrier, $carriers );
						break;
					} else {
						continue;
					}
				}
				array_splice( $carriers, $position, 1 );
				$args['custom_carriers_list'] = vi_wot_json_encode( $carriers );
				update_option( 'woo_orders_tracking_settings', $args );
				wp_send_json(
					array(
						'status'   => 'success',
						'position' => $position,
					)
				);
			} else {
				wp_send_json(
					array(
						'status'  => 'error',
						'message' => 'can\'t delete carrier',
						'details' => array( 'custom_carriers_list' => $carriers )
					)
				);
			}
		} else {
			wp_send_json(
				array(
					'status'  => 'error',
					'message' => esc_html__( 'Not enough information', 'woocommerce-orders-tracking' ),
					'details' => array( 'slug' => $carrier_slug )
				)
			);
		}
	}

	public function wotv_admin_edit_shipping_carrier() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		if ( ! isset( $_POST['action_nonce'] ) || ! wp_verify_nonce( $_POST['action_nonce'], 'vi_wot_setting_action_nonce' ) ) {
			return;
		}
		$carrier_slug     = isset( $_POST['carrier_slug'] ) ? sanitize_text_field( $_POST['carrier_slug'] ) : '';
		$carrier_name     = isset( $_POST['carrier_name'] ) ? sanitize_text_field( $_POST['carrier_name'] ) : '';
		$display_name     = empty( $_POST['display_name'] ) ? $carrier_name : sanitize_text_field( $_POST['display_name'] );
		$shipping_country = isset( $_POST['shipping_country'] ) ? sanitize_text_field( $_POST['shipping_country'] ) : '';
		$tracking_url     = isset( $_POST['tracking_url'] ) ? sanitize_text_field( $_POST['tracking_url'] ) : '';
		$digital_delivery = isset( $_POST['digital_delivery'] ) ? sanitize_text_field( $_POST['digital_delivery'] ) : '';
		if ( $carrier_slug && $carrier_name && $shipping_country && $tracking_url ) {
			$args     = array();
			$carriers = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_custom_carriers();
			if ( count( $carriers ) ) {
				foreach ( $carriers as $key => $shipping_carrier ) {
					if ( $shipping_carrier['slug'] === $carrier_slug ) {
						$shipping_carrier['name']             = $carrier_name;
						$shipping_carrier['display_name']     = $display_name;
						$shipping_carrier['country']          = $shipping_country;
						$shipping_carrier['url']              = $tracking_url;
						$shipping_carrier['digital_delivery'] = $digital_delivery;
						$carriers[ $key ]                     = $shipping_carrier;
						$args['custom_carriers_list']         = vi_wot_json_encode( $carriers );
						$args                                 = wp_parse_args( $args, $this->settings->get_params() );
						update_option( 'woo_orders_tracking_settings', $args );
						$this->save_carrier_name_in_existing_orders( $carrier_slug, $display_name, $carrier_name );
						wp_send_json(
							array(
								'status'           => 'success',
								'carrier_name'     => $carrier_name,
								'display_name'     => $display_name,
								'shipping_country' => $shipping_country,
								'tracking_url'     => $tracking_url,
								'digital_delivery' => $digital_delivery,
							)
						);
					}
				}
			}
			$defined_carriers = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_defined_carriers();
			foreach ( $defined_carriers as $key => $shipping_carrier ) {
				if ( $shipping_carrier['slug'] === $carrier_slug ) {
					$shipping_carrier['display_name']      = $display_name;
					$defined_carriers[ $key ]              = $shipping_carrier;
					$args['shipping_carriers_define_list'] = vi_wot_json_encode( $defined_carriers );
					$args                                  = wp_parse_args( $args, $this->settings->get_params() );
					update_option( 'woo_orders_tracking_settings', $args );
					$this->save_carrier_name_in_existing_orders( $carrier_slug, $display_name, $carrier_name );
					wp_send_json(
						array(
							'status'           => 'success',
							'carrier_name'     => $carrier_name,
							'display_name'     => $display_name,
							'shipping_country' => $shipping_country,
							'tracking_url'     => $tracking_url,
							'digital_delivery' => $digital_delivery,
						)
					);
				}
			}
			wp_send_json(
				array(
					'status'  => 'error',
					'message' => 'can\'t edit carrier',
					'details' => array( 'custom_carriers_list' => $carriers )
				)
			);
		} else {
			wp_send_json(
				array(
					'status'  => 'error',
					'message' => esc_html__( 'Not enough information', 'woocommerce-orders-tracking' ),
					'details' => array(
						'name'    => $carrier_name,
						'slug'    => $carrier_slug,
						'country' => $shipping_country,
						'url'     => $tracking_url
					)
				)
			);
		}
	}

	/**
	 * @param $carrier_slug
	 * @param $display_name
	 * @param $carrier_name
	 */
	private function save_carrier_name_in_existing_orders( $carrier_slug, $display_name, $carrier_name ) {
		if ( $this->settings->get_params( 'save_carrier_name_in_post_meta' ) ) {
			if ( ! $display_name ) {
				$display_name = $carrier_name;
			}
			if ( $display_name ) {
				$args      = array(
					'posts_per_page' => - 1,
					'return'         => 'ids',
					'meta_query'     => array(// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
						'relation' => 'AND',
						array(
							'key'     => '_wot_tracking_carrier',
							'value'   => $carrier_slug,
							'compare' => '=',
						),
						array(
							'relation' => 'or',
							array(
								'key'     => '_wot_tracking_carrier_name',
								'compare' => 'NOT EXISTS',
							),
							array(
								'key'     => '_wot_tracking_carrier_name',
								'value'   => $display_name,
								'compare' => '!=',
							),
						)
					),
				);
				$order_ids = wc_get_orders( $args );
				foreach ( $order_ids as $order_id ) {
					$order = wc_get_order( $order_id );
					$order->update_meta_data( '_wot_tracking_carrier_name', $display_name );
					$order->save_meta_data();
				}
			}
		}
	}

	public function wotv_admin_add_new_shipping_carrier() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		if ( ! isset( $_POST['action_nonce'] ) || ! wp_verify_nonce( $_POST['action_nonce'], 'vi_wot_setting_action_nonce' ) ) {
			return;
		}
		$from_service     = isset( $_POST['from_service'] ) ? sanitize_text_field( $_POST['from_service'] ) : '';
		$carrier_name     = isset( $_POST['carrier_name'] ) ? sanitize_text_field( $_POST['carrier_name'] ) : '';
		$carrier_slug     = isset( $_POST['carrier_slug'] ) ? sanitize_title( $_POST['carrier_slug'] ) : '';
		$display_name     = empty( $_POST['display_name'] ) ? $carrier_name : sanitize_text_field( $_POST['display_name'] );
		$tracking_url     = isset( $_POST['tracking_url'] ) ? sanitize_text_field( $_POST['tracking_url'] ) : '';
		$shipping_country = isset( $_POST['shipping_country'] ) ? sanitize_text_field( $_POST['shipping_country'] ) : '';
		$digital_delivery = isset( $_POST['digital_delivery'] ) ? sanitize_text_field( $_POST['digital_delivery'] ) : '';
		if ( $carrier_name && $tracking_url && $shipping_country ) {
			$args                 = $this->settings->get_params();
			$custom_carriers_list = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_custom_carriers();
			$carriers             = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_carriers();
			$from_carrier         = '';
			switch ( $from_service ) {
				case 'tracktry':
					$from_carrier = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKTRY::get_carrier_slug_by_name( $carrier_name );
					break;
				case '17track':
					$from_carrier = VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::get_carrier_slug_by_name( $carrier_name );
					break;
				case 'trackingmore':
					$from_carrier = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::get_carrier_slug_by_name( $carrier_name );
					break;
				default:
			}
			if ( $carrier_slug ) {
				$exist = array_search( $carrier_slug, array_column( $carriers, 'slug' ) );
				if ( $exist !== false ) {
					wp_send_json(
						array(
							'status'  => 'error',
							'message' => esc_html__( 'Slug exists, please choose another slug or leave slug field blank', 'woocommerce-orders-tracking' ),
							'carrier' => $carriers[ $exist ]['name'],
						)
					);
				}
			} else {
				$carrier_slug = sanitize_title( $carrier_name );
				$exist        = array_search( $carrier_slug, array_column( $carriers, 'slug' ) );
				if ( $exist !== false ) {
					$carrier_slug = 'custom_' . time();
				}
			}
			$custom_carrier = array(
				'name'             => $carrier_name,
				'display_name'     => $display_name,
				'slug'             => $carrier_slug,
				'url'              => $tracking_url,
				'country'          => $shipping_country,
				'type'             => 'custom',
				'digital_delivery' => $digital_delivery,
			);
			if ( $from_carrier && $from_service ) {
				$custom_carrier['from_service'] = $from_service;
				$custom_carrier['from_carrier'] = $from_carrier;
			}
			$custom_carriers_list[]       = $custom_carrier;
			$args['custom_carriers_list'] = vi_wot_json_encode( $custom_carriers_list );
			$args['active_carriers'][]    = $carrier_slug;
			update_option( 'woo_orders_tracking_settings', $args );
			wp_send_json(
				array(
					'status'  => 'success',
					'carrier' => $custom_carrier,
				)
			);
		} else {
			wp_send_json(
				array(
					'status'  => 'error',
					'message' => esc_html__( 'Please enter all required fields', 'woocommerce-orders-tracking' ),
					'details' => array(
						'carrier_name'     => $carrier_name,
						'tracking_url'     => $tracking_url,
						'shipping_country' => $shipping_country
					)
				)
			);
		}
	}

	public function preview_emails_button( $editor_id ) {
		global $pagenow;
		if ( $pagenow === 'admin.php' && isset( $_REQUEST['page'] ) && sanitize_text_field( $_REQUEST['page'] ) === 'woocommerce-orders-tracking' ) {// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$editor_ids = array( 'wot-email-content' );
			if ( count( $this->languages ) ) {
				foreach ( $this->languages as $key => $value ) {
					$editor_ids[] = 'wot-email-content_' . $value;
				}
			}
			if ( in_array( $editor_id, $editor_ids ) ) {
				?>
                <span class="<?php echo esc_attr( self::set( 'preview-emails-button' ) ) ?> button"
                      data-wot_language="<?php echo esc_attr( str_replace( 'wot-email-content', '', $editor_id ) ) ?>"><?php esc_html_e( 'Preview emails',
						'woocommerce-orders-tracking' ) ?></span>
				<?php
			}
		}
	}


	public function wot_preview_emails() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		if ( ! isset( $_GET['action_nonce'] ) || ! wp_verify_nonce( $_GET['action_nonce'], 'vi_wot_setting_action_nonce' ) ) {
			return;
		}
		$shortcodes = array(
			'order_id'                    => 2020,
			'order_number'                => '2020',
			'order_status'                => 'processing',
			'order_date'                  => date_i18n( 'F d, Y', strtotime( 'today' ) ),
			'order_total'                 => 999,
			'order_subtotal'              => 990,
			'items_count'                 => 1,
			'payment_method'              => 'Cash on delivery',
			'shipping_method'             => 'Free shipping',
			'shipping_address'            => 'Thainguyen City',
			'formatted_shipping_address'  => 'Thainguyen City, Vietnam',
			'billing_address'             => 'Thainguyen City',
			'formatted_billing_address'   => 'Thainguyen City, Vietnam',
			'billing_country'             => 'VN',
			'billing_city'                => 'Thainguyen',
			'billing_first_name'          => 'John',
			'billing_last_name'           => 'Doe',
			'formatted_billing_full_name' => 'John Doe',
			'billing_email'               => 'support@villatheme.com',
			'shop_title'                  => get_bloginfo(),
			'home_url'                    => home_url(),
			'shop_url'                    => get_option( 'woocommerce_shop_page_id', '' ) ? get_page_link( get_option( 'woocommerce_shop_page_id' ) ) : '',
		);

		$content                      = isset( $_GET['content'] ) ? wp_kses_post( stripslashes( $_GET['content'] ) ) : '';
		$email_column_tracking_number = isset( $_GET['email_column_tracking_number'] ) ? wp_kses_post( stripslashes( $_GET['email_column_tracking_number'] ) ) : '';
		$email_column_carrier_name    = isset( $_GET['email_column_carrier_name'] ) ? wp_kses_post( stripslashes( $_GET['email_column_carrier_name'] ) ) : '';
		$email_column_tracking_url    = isset( $_GET['email_column_tracking_url'] ) ? wp_kses_post( stripslashes( $_GET['email_column_tracking_url'] ) ) : '';
		$heading                      = isset( $_GET['heading'] ) ? ( stripslashes( $_GET['heading'] ) ) : '';
		$heading                      = str_replace( array(
			'{order_id}',
			'{order_number}',
			'{billing_first_name}',
			'{billing_last_name}'
		), array(
			$shortcodes['order_id'],
			$shortcodes['order_number'],
			$shortcodes['billing_first_name'],
			$shortcodes['billing_last_name']
		), $heading );
		$service_tracking_page        = $this->settings->get_params( 'service_tracking_page' );
		if ( ! $this->settings->get_params( 'service_carrier_enable' ) ) {
			$service_tracking_page = '';
		} else {
			$service_tracking_page = get_page_link( $service_tracking_page );
		}
		$imported = array(
			array(
				'order_item_name' => "Legging",
				'tracking_number' => "LTyyyyyyyyyCN",
				'carrier_name'    => "UPS",
				'carrier_url'     => "https://wwwapps.ups.com/WebTracking/track?track=yes&trackNums",
				'tracking_url'    => $service_tracking_page ? add_query_arg( array( 'tracking_id' => "LTyyyyyyyyyCN" ), $service_tracking_page )
					: 'https://wwwapps.ups.com/WebTracking/track?track=yes&trackNums=LTyyyyyyyyyCN',
			),
			array(
				'order_item_name' => "T-shirt",
				'tracking_number' => "LTxxxxxxxxxCN",
				'carrier_name'    => "Yun Express",
				'carrier_url'     => "http://www.yuntrack.com/Track/",
				'tracking_url'    => $service_tracking_page ? add_query_arg( array( 'tracking_id' => "LTxxxxxxxxxCN" ), $service_tracking_page )
					: 'http://www.yuntrack.com/Track/Detail/LTxxxxxxxxxCN',
			),
		);
		ob_start();
		?>
        <table class="<?php echo esc_attr( self::set( 'preview-email-table' ) ) ?>">
            <thead>
            <tr>
                <th><?php esc_html_e( 'Product title', 'woocommerce-orders-tracking' ) ?></th>
				<?php
				if ( $email_column_tracking_number ) {
					?>
                    <th><?php esc_html_e( 'Tracking number', 'woocommerce-orders-tracking' ) ?></th>
					<?php
				}
				if ( $email_column_carrier_name ) {
					?>
                    <th><?php esc_html_e( 'Carrier name', 'woocommerce-orders-tracking' ) ?></th>
					<?php
				}
				if ( $email_column_tracking_url ) {
					?>
                    <th><?php esc_html_e( 'Tracking link', 'woocommerce-orders-tracking' ) ?></th>
					<?php
				}
				?>
            </tr>
            </thead>
            <tbody>
			<?php
			foreach ( $imported as $item ) {
				?>
                <tr>
                    <td><?php echo wp_kses_post( $item['order_item_name'] ); ?></td>
					<?php
					if ( $email_column_tracking_number ) {
						?>
                        <td><?php echo wp_kses_post( str_replace( array(
								'{tracking_number}',
								'{carrier_name}',
								'{tracking_url}',
							), array(
								$item['tracking_number'],
								$item['carrier_name'],
								$item['tracking_url'],
							), $email_column_tracking_number ) ); ?></td>
						<?php
					}
					if ( $email_column_carrier_name ) {
						?>
                        <td><?php echo wp_kses_post( str_replace( array(
								'{tracking_number}',
								'{carrier_name}',
								'{tracking_url}',
							), array(
								$item['tracking_number'],
								$item['carrier_name'],
								$item['tracking_url'],
							), $email_column_carrier_name ) ); ?></td>
						<?php
					}
					if ( $email_column_tracking_url ) {
						?>
                        <td><?php echo wp_kses_post( str_replace( array(
								'{tracking_number}',
								'{carrier_name}',
								'{tracking_url}',
							), array(
								$item['tracking_number'],
								$item['carrier_name'],
								$item['tracking_url'],
							), $email_column_tracking_url ) ); ?></td>
						<?php
					}
					?>
                </tr>
				<?php
			}
			?>
            </tbody>
        </table>
		<?php
		$tracking_table = ob_get_clean();
		$content        = str_replace( array(
			'{order_id}',
			'{order_number}',
			'{billing_first_name}',
			'{billing_last_name}',
			'{tracking_number}',
			'{carrier_name}',
			'{carrier_url}',
			'{tracking_url}',
			'{tracking_table}',
		), array(
			$shortcodes['order_id'],
			$shortcodes['order_number'],
			$shortcodes['billing_first_name'],
			$shortcodes['billing_last_name'],
			$imported[0]['tracking_number'],
			$imported[0]['carrier_name'],
			$imported[0]['carrier_url'],
			$imported[0]['tracking_url'],
			$tracking_table
		), $content );
		$mailer         = WC()->mailer();
		$email          = new WC_Email();
		$content        = $email->style_inline( $mailer->wrap_message( $heading, $content ) );
		wp_send_json(
			array(
				'html' => $content,
			)
		);
	}

	public function wot_test_connection_paypal() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		if ( ! isset( $_POST['action_nonce'] ) || ! wp_verify_nonce( $_POST['action_nonce'], 'vi_wot_setting_action_nonce' ) ) {
			return;
		}
		$client_id = isset( $_POST['client_id'] ) ? sanitize_text_field( $_POST['client_id'] ) : '';
		$secret    = isset( $_POST['secret'] ) ? sanitize_text_field( $_POST['secret'] ) : '';
		$sandbox   = isset( $_POST['sandbox'] ) ? sanitize_text_field( $_POST['sandbox'] ) : '';
		if ( $secret && $sandbox && $client_id ) {
			if ( $sandbox === 'no' ) {
				$sandbox = false;
			}
			$check_token = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_access_token( $client_id, $secret, $sandbox, true );
			if ( $check_token['status'] === 'success' ) {
				$message = '<p class="' . esc_attr( self::set( 'success' ) ) . '">' . esc_html__( 'Successfully!', 'woocommerce-orders-tracking' ) . '</p>';
			} else {
				$message = '<p class="' . esc_attr( self::set( 'error' ) ) . '">' . $check_token['data'] . '</p>';
			}
			wp_send_json(
				array(
					'message' => $message
				)
			);
		}
	}

	public function orders_tracking_admin_footer() {
		$countries = new WC_Countries();
		$countries = $countries->get_countries();
		?>
        <div class="preview-emails-html-container woo-orders-tracking-footer-container woo-orders-tracking-hidden">
            <div class="preview-emails-html-overlay woo-orders-tracking-overlay"></div>
            <div class="preview-emails-html woo-orders-tracking-footer-content"></div>
        </div>
        <div class="edit-shipping-carrier-html-container woo-orders-tracking-footer-container woo-orders-tracking-hidden">
            <div class="edit-shipping-carrier-html-overlay woo-orders-tracking-overlay"></div>
            <div class="edit-shipping-carrier-html-content woo-orders-tracking-footer-content">
                <div class="edit-shipping-carrier-html-content-header">
                    <h2><?php esc_html_e( 'Edit shipping carrier', 'woocommerce-orders-tracking' ) ?></h2>
                    <i class="close icon edit-shipping-carrier-html-content-close"></i>
                </div>
                <div class="edit-shipping-carrier-html-content-body">
                    <div class="edit-shipping-carrier-html-content-body-row">
                        <div class="edit-shipping-carrier-html-content-body-carrier-name-wrap">
                            <label for="edit-shipping-carrier-html-content-body-carrier-name"><?php esc_html_e( 'Carrier Name', 'woocommerce-orders-tracking' ) ?></label>
                            <input type="text" id="edit-shipping-carrier-html-content-body-carrier-name">
                        </div>
                        <div class="edit-shipping-carrier-html-content-body-carrier-display-name-wrap">
                            <label for="edit-shipping-carrier-html-content-body-carrier-display-name"><?php esc_html_e( 'Display Name', 'woocommerce-orders-tracking' ) ?></label>
                            <input type="text" id="edit-shipping-carrier-html-content-body-carrier-display-name"
                                   placeholder="<?php esc_attr_e( 'Carrier name that shows to customers', 'woocommerce-orders-tracking' ) ?>">
                        </div>
                        <div class="edit-shipping-carrier-html-content-body-country-wrap">
                            <label for="edit-shipping-carrier-html-content-body-country"><?php esc_html_e( 'Shipping Country', 'woocommerce-orders-tracking' ) ?></label>
                            <select id="edit-shipping-carrier-html-content-body-country"
                                    class="edit-shipping-carrier-html-content-body-country">
                                <option value=""></option>
                                <option value="Global"><?php esc_html_e( 'Global', 'woocommerce-orders-tracking' ) ?></option>
								<?php
								foreach ( $countries as $country_code => $country_name ) {
									?>
                                    <option value="<?php echo esc_attr( $country_code ) ?>"><?php echo esc_html( $country_name ) ?></option>
									<?php
								}
								?>
                            </select>
                        </div>
                    </div>
                    <div class="edit-shipping-carrier-html-content-body-row">
                        <div>
                            <input type="checkbox"
                                   id="edit-shipping-carrier-is-digital-delivery"
                                   class="edit-shipping-carrier-is-digital-delivery">
                            <label for="edit-shipping-carrier-is-digital-delivery"><?php esc_html_e( 'Check if this is a Digital Delivery carrier. Tracking number is not required for this kind of carrier',
									'woocommerce-orders-tracking' ) ?></label>
                        </div>
                    </div>
                    <div class="edit-shipping-carrier-html-content-body-row">
                        <div class="edit-shipping-carrier-html-content-body-carrier-url-wrap">
                            <label for="edit-shipping-carrier-html-content-body-carrier-url"><?php esc_html_e( 'Carrier URL', 'woocommerce-orders-tracking' ) ?></label>
                            <input type="text" id="edit-shipping-carrier-html-content-body-carrier-url"
                                   placeholder="http://yourcarrier.com/{tracking_number}">
                            <p class="description">
                                <strong>{tracking_number}</strong>: <?php esc_html_e( 'The placeholder for tracking number of an item', 'woocommerce-orders-tracking' ) ?>
                            </p>
                            <p class="description">
                                <strong>{postal_code}</strong>:<?php esc_html_e( 'The placeholder for postal code of an order', 'woocommerce-orders-tracking' ) ?>
                            </p>
                            <p class="description"><?php esc_html_e( 'eg: https://www.dhl.com/en/express/tracking.html?AWB={tracking_number}&brand=DHL',
									'woocommerce-orders-tracking' ); ?></p>
                            <p class="description wotv-error-tracking-url"><?php esc_html_e( 'The tracking url will not include tracking number because carrier URL does not include {tracking_number}',
									'woocommerce-orders-tracking' ) ?>
                            </p>
                        </div>
                    </div>
                </div>
                <div class="edit-shipping-carrier-html-content-footer">
                    <button type="button"
                            class="vi-ui button primary edit-shipping-carrier-html-btn-save">
						<?php esc_html_e( 'Save', 'woocommerce-orders-tracking' ) ?>
                    </button>
                    <button type="button"
                            class="vi-ui button edit-shipping-carrier-html-btn-cancel">
						<?php esc_html_e( 'Cancel', 'woocommerce-orders-tracking' ) ?>
                    </button>
                </div>
            </div>
        </div>
        <div class="add-new-shipping-carrier-html-container woo-orders-tracking-footer-container woo-orders-tracking-hidden">
            <div class="add-new-shipping-carrier-html-overlay woo-orders-tracking-overlay"></div>
            <div class="add-new-shipping-carrier-html-content woo-orders-tracking-footer-content">
                <div class="add-new-shipping-carrier-html-content-header">
                    <h2><?php esc_html_e( 'Add custom shipping carrier', 'woocommerce-orders-tracking' ) ?></h2>
                    <i class="close icon add-new-shipping-carrier-html-content-close"></i>
                </div>
                <div class="add-new-shipping-carrier-html-content-body">
                    <div class="add-new-shipping-carrier-html-content-body-row add-new-shipping-carrier-html-content-body-row-choose-from">
                        <div class="add-new-shipping-carrier-html-content-body-add-carrier-type-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-add-carrier-type"><?php esc_html_e( 'Add your own carrier or choose from',
									'woocommerce-orders-tracking' ) ?></label>
                            <select class="vi-ui fluid dropdown"
                                    id="add-new-shipping-carrier-html-content-body-add-carrier-type">
                                <option value="new"><?php esc_html_e( 'Add my own carrier', 'woocommerce-orders-tracking' ) ?></option>
                                <option value="trackingmore"><?php esc_html_e( 'Choose from TrackingMore carriers', 'woocommerce-orders-tracking' ) ?></option>
                                <option value="17track"><?php esc_html_e( 'Choose from 17Track carriers', 'woocommerce-orders-tracking' ) ?></option>
                                <option value="tracktry"><?php esc_html_e( 'Choose from Tracktry carriers', 'woocommerce-orders-tracking' ) ?></option>
                            </select>
                        </div>
                        <div class="add-new-shipping-carrier-html-content-body-choose-from-wrap add-new-shipping-carrier-html-content-body-choose-from-trackingmore-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-choose-from-trackingmore"><?php esc_html_e( 'Select a carrier',
									'woocommerce-orders-tracking' ) ?></label>
                            <select class="vi-ui fluid search"
                                    id="add-new-shipping-carrier-html-content-body-choose-from-trackingmore"></select>
                        </div>
                        <div class="add-new-shipping-carrier-html-content-body-choose-from-wrap add-new-shipping-carrier-html-content-body-choose-from-17track-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-choose-from-17track"><?php esc_html_e( 'Select a carrier',
									'woocommerce-orders-tracking' ) ?></label>
                            <select class="vi-ui fluid search"
                                    id="add-new-shipping-carrier-html-content-body-choose-from-17track"></select>
                        </div>
                        <div class="add-new-shipping-carrier-html-content-body-choose-from-wrap add-new-shipping-carrier-html-content-body-choose-from-tracktry-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-choose-from-tracktry"><?php esc_html_e( 'Select a carrier',
									'woocommerce-orders-tracking' ) ?></label>
                            <select class="vi-ui fluid search"
                                    id="add-new-shipping-carrier-html-content-body-choose-from-tracktry"></select>
                        </div>
                    </div>
                    <div class="add-new-shipping-carrier-html-content-body-row">
                        <div class="add-new-shipping-carrier-html-content-body-carrier-name-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-carrier-name"><?php esc_html_e( 'Carrier Name(required)',
									'woocommerce-orders-tracking' ) ?></label>
                            <input type="text" required id="add-new-shipping-carrier-html-content-body-carrier-name">
                        </div>
                        <div class="add-new-shipping-carrier-html-content-body-carrier-display-name-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-carrier-display-name"><?php esc_html_e( 'Display Name',
									'woocommerce-orders-tracking' ) ?></label>
                            <input type="text" id="add-new-shipping-carrier-html-content-body-carrier-display-name"
                                   placeholder="<?php esc_attr_e( 'Carrier name that shows to customers', 'woocommerce-orders-tracking' ) ?>">
                        </div>
                        <div class="add-new-shipping-carrier-html-content-body-carrier-slug-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-carrier-slug"><?php esc_html_e( 'Carrier Slug', 'woocommerce-orders-tracking' ) ?></label>
                            <input type="text" id="add-new-shipping-carrier-html-content-body-carrier-slug"
                                   placeholder="<?php esc_attr_e( 'Generated from name if empty', 'woocommerce-orders-tracking' ) ?>">
                        </div>
                        <div class="add-new-shipping-carrier-html-content-body-country-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-country"><?php esc_html_e( 'Shipping Country', 'woocommerce-orders-tracking' ) ?></label>
                            <select id="add-new-shipping-carrier-html-content-body-country"
                                    class="add-new-shipping-carrier-html-content-body-country">
                                <option value="Global"
                                        selected><?php esc_html_e( 'Global', 'woocommerce-orders-tracking' ) ?></option>
								<?php
								foreach ( $countries as $country_code => $country_name ) {
									?>
                                    <option value="<?php echo esc_attr( $country_code ) ?>"><?php echo esc_html( $country_name ) ?></option>
									<?php
								}
								?>
                            </select>
                        </div>
                    </div>
                    <div class="add-new-shipping-carrier-html-content-body-row">
                        <div>
                            <input type="checkbox"
                                   id="add-new-shipping-carrier-is-digital-delivery"
                                   class="add-new-shipping-carrier-is-digital-delivery">
                            <label for="add-new-shipping-carrier-is-digital-delivery"><?php esc_html_e( 'Check if this is a Digital Delivery carrier. Tracking number is not required for this kind of carrier',
									'woocommerce-orders-tracking' ) ?></label>
                        </div>
                    </div>
                    <div class="add-new-shipping-carrier-html-content-body-row">
                        <div class="add-new-shipping-carrier-html-content-body-carrier-url-wrap">
                            <label for="add-new-shipping-carrier-html-content-body-carrier-url"><?php esc_html_e( 'Carrier URL(required)',
									'woocommerce-orders-tracking' ) ?></label>
                            <input type="text" id="add-new-shipping-carrier-html-content-body-carrier-url"
                                   placeholder="http://yourcarrier.com/{tracking_number}">
                            <p class="description">
                                <strong>{tracking_number}</strong>: <?php esc_html_e( 'The placeholder for tracking number of an item', 'woocommerce-orders-tracking' ) ?>
                            </p>
                            <p class="description">
                                <strong>{postal_code}</strong>: <?php esc_html_e( 'The placeholder for postal code of an order', 'woocommerce-orders-tracking' ) ?>
                            </p>
                            <p class="description"><?php esc_html_e( 'eg: https://www.dhl.com/en/express/tracking.html?AWB={tracking_number}&brand=DHL',
									'woocommerce-orders-tracking' ); ?></p>
                            <p class="description wotv-error-tracking-url"><?php esc_html_e( 'The tracking url will not include tracking number if carrier URL does not include {tracking_number}',
									'woocommerce-orders-tracking' ) ?></p>
                        </div>
                    </div>
                </div>
                <div class="add-new-shipping-carrier-html-content-footer">
                    <button type="button"
                            class="vi-ui mini button primary add-new-shipping-carrier-html-btn-save"><?php esc_html_e( 'Add New', 'woocommerce-orders-tracking' ) ?></button>
                    <button type="button"
                            class="vi-ui mini button add-new-shipping-carrier-html-btn-cancel"><?php esc_html_e( 'Cancel', 'woocommerce-orders-tracking' ) ?></button>
                </div>
            </div>
        </div>
		<?php
	}

	public static function admin_enqueue_semantic() {
		wp_dequeue_script( 'select-js' );//Causes select2 error, from ThemeHunk MegaMenu Plus plugin
		wp_dequeue_style( 'eopa-admin-css' );
		wp_enqueue_style( 'semantic-ui-message', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'message.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-input', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'input.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-label', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'label.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-accordion', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'accordion.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-button', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'button.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-checkbox', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'checkbox.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-dropdown', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'dropdown.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-form', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'form.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-input', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'input.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-popup', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'popup.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-icon', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'icon.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-menu', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'menu.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-segment', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'segment.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-tab', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'tab.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'semantic-ui-table', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'table.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_script( 'semantic-ui-accordion', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'accordion.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
		wp_enqueue_script( 'semantic-ui-address', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'address.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
		wp_enqueue_script( 'semantic-ui-checkbox', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'checkbox.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
		wp_enqueue_script( 'semantic-ui-dropdown', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'dropdown.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
		wp_enqueue_script( 'semantic-ui-form', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'form.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
		wp_enqueue_script( 'semantic-ui-tab', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'tab.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
	}

	public function admin_enqueue_script() {
		global $pagenow;
		$page = isset( $_REQUEST['page'] ) ? sanitize_text_field( $_REQUEST['page'] ) : '';// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( $pagenow === 'admin.php' && $page === 'woocommerce-orders-tracking' ) {
			self::admin_enqueue_semantic();
			add_action( 'admin_footer', array( $this, 'orders_tracking_admin_footer' ) );
			$this->schedule_send_emails = wp_next_scheduled( 'vi_wot_send_mails_for_import_csv_function' );
			wp_enqueue_style( 'vi-wot-admin-setting-css', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'admin-setting.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'vi-wot-admin-setting-support', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'villatheme-support.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_script( 'iris', admin_url( 'js/iris.min.js' ), array(
				'jquery-ui-draggable',
				'jquery-ui-slider',
				'jquery-touch-punch'
			), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, true );

			wp_enqueue_script( 'vi-wot-admin-setting-carrier-functions-js', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . '/carrier-functions.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			if ( ! wp_script_is( 'transition' ) ) {
				wp_enqueue_style( 'transition', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'transition.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
				wp_enqueue_script( 'transition', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'transition.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			}
			if ( ! wp_script_is( 'select2' ) ) {
				wp_enqueue_style( 'select2', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'select2.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
				wp_enqueue_script( 'select2', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'select2.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			}
			wp_enqueue_script( 'vi-wot-admin-setting-js', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'admin-setting.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			$countries                = new WC_Countries();
			$this->shipping_countries = $countries->get_countries();
			wp_localize_script(
				'vi-wot-admin-setting-js',
				'vi_wot_admin_settings',
				array(
					'ajax_url'                      => admin_url( 'admin-ajax.php' ),
					'shipping_carrier_default'      => $this->settings->get_params( 'shipping_carrier_default' ),
					'carriers'                      => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_carriers(),
					'active_carriers'               => $this->settings->get_params( 'active_carriers' ),
					'shipping_countries'            => $this->shipping_countries,
					'service_carriers_list'         => array_keys( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::service_carriers_list() ),
					'select_default_carrier_text'   => esc_html__( 'Set Default', 'woocommerce-orders-tracking' ),
					'add_new_error_empty_field'     => esc_html__( 'Please fill full information for carrier', 'woocommerce-orders-tracking' ),
					'confirm_delete_carrier_custom' => esc_html__( 'Are you sure you want to delete this carrier?', 'woocommerce-orders-tracking' ),
					'confirm_delete_string_replace' => esc_html__( 'Remove this item?', 'woocommerce-orders-tracking' ),
					'display_name_title'            => esc_html__( 'Display name: your customers see this instead of real carrier name', 'woocommerce-orders-tracking' ),
					'i18n_copy_shortcode'           => esc_html__( 'Click to copy', 'woocommerce-orders-tracking' ),
					'i18n_shortcode_copied'         => esc_html__( 'Copied to clipboard!', 'woocommerce-orders-tracking' ),
					'i18n_active_carrier'           => esc_html__( 'Active', 'woocommerce-orders-tracking' ),
					'i18n_search_carrier'           => esc_attr__( 'Search carrier name', 'woocommerce-orders-tracking' ),
					'i18n_added_carrier'            => esc_html__( 'Successfully added new carrier: %s', 'woocommerce-orders-tracking' ),
					// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
					'i18n_sms_empty_api'            => esc_html__( 'Please enter your SMS provider API.', 'woocommerce-orders-tracking' ),
					'i18n_sms_empty_message'        => esc_html__( 'Please fill in the message text', 'woocommerce-orders-tracking' ),
					'i18n_sms_empty_phone'          => esc_html__( 'Please enter your phone number to send a test SMS message to.', 'woocommerce-orders-tracking' ),
					'i18n_send_sms_to'              => esc_html__( 'Send a test SMS message to %s?', 'woocommerce-orders-tracking' ),
					// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
					'i18n_remove_row_confirm'       => esc_html__( 'Do you want to remove this row?', 'woocommerce-orders-tracking' ),
				)
			);
		}
	}

	public static function table_of_placeholders( $args ) {
		if ( count( $args ) ) {
			?>
            <table class="vi-ui celled table <?php echo esc_attr( self::set( 'table-of-placeholders' ) ) ?>">
                <thead>
                <tr>
                    <th><?php esc_html_e( 'Placeholder', 'woocommerce-orders-tracking' ) ?></th>
                    <th><?php esc_html_e( 'Explanation', 'woocommerce-orders-tracking' ) ?></th>
                </tr>
                </thead>
                <tbody>
				<?php
				foreach ( $args as $key => $value ) {
					?>
                    <tr>
                        <td class="<?php echo esc_attr( self::set( 'placeholder-value-container' ) ) ?>"><input
                                    class="<?php echo esc_attr( self::set( 'placeholder-value' ) ) ?>" type="text"
                                    readonly value="<?php echo esc_attr( "{{$key}}" ); ?>"><i
                                    class="vi-ui icon copy <?php echo esc_attr( self::set( 'placeholder-value-copy' ) ) ?>"
                                    title="<?php esc_attr_e( 'Copy', 'woocommerce-orders-tracking' ) ?>"></i></td>
                        <td><?php echo esc_html( "{$value}" ); ?></td>
                    </tr>
					<?php
				}
				?>
                </tbody>
            </table>
			<?php
		}
	}

	public function search_page() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'change_settings' ) ) ) {
			return;
		}
		$keyword = isset( $_GET['keyword'] ) ? sanitize_text_field( $_GET['keyword'] ) : '';
		if ( ! $keyword ) {
			$keyword = isset( $_POST['keyword'] ) ? sanitize_text_field( $_POST['keyword'] ) : '';
		}
		if ( empty( $keyword ) ) {
			die();
		}
		$args      = array(
			'post_status'    => 'any',
			'post_type'      => 'page',
			'posts_per_page' => 50,
			's'              => $keyword,
			'fields'         => 'ids',
		);
		$the_query = new WP_Query( $args );
		$items     = array();
		if ( $the_query->have_posts() ) {
			foreach ( $the_query->posts as $page_id ) {
				$items[] = array( 'id' => $page_id, 'text' => get_the_title( $page_id ) );
			}
		}
		wp_reset_postdata();
		wp_send_json( $items );
	}

	public function print_other_country_flag( $param, $lang ) {
		?>
        <p>
            <label for="<?php echo esc_attr( self::set( "{$param}_{$lang}" ) ); ?>"><?php
				if ( isset( $this->languages_data[ $lang ]['country_flag_url'] ) && $this->languages_data[ $lang ]['country_flag_url'] ) {
					?>
                    <img src="<?php echo esc_url( $this->languages_data[ $lang ]['country_flag_url'] ); ?>">
					<?php
				}
				echo wp_kses_post( $lang );
				if ( isset( $this->languages_data[ $lang ]['translated_name'] ) ) {
					echo wp_kses_post( '(' . $this->languages_data[ $lang ]['translated_name'] . ')' );
				}
				?>:</label>
        </p>
		<?php
	}

	public static function get_email_templates( $type = 'wot_email' ) {
		$email_templates = array();
		if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::is_email_template_customizer_active() ) {
			$email_templates = viwec_get_emails_list( $type );
		}

		return $email_templates;
	}

}