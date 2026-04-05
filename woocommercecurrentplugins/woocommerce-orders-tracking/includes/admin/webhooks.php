<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_WEBHOOKS' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_WEBHOOKS {
		protected static $settings;

		public function __construct() {
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			add_action( 'admin_menu', array( $this, 'admin_menu' ), 16 );
			add_action( 'admin_init', array( $this, 'save_options' ) );
			add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
			add_action( 'rest_api_init', array( $this, 'register_api' ) );
			add_filter( 'woo_orders_tracking_settings-webhooks_send_email_17track', array(
				$this,
				'convert_17track_v1_statuses'
			) );
		}

		/**
		 * @param $statuses
		 *
		 * @return mixed
		 */
		public function convert_17track_v1_statuses( $statuses ) {
			if ( is_array( $statuses ) && count( $statuses ) ) {
				foreach ( $statuses as &$status ) {
					$status = VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::convert_v1_statuses( $status );
				}
			}

			return $statuses;
		}

		/**
		 *
		 */
		public function save_options() {
			global $woo_orders_tracking_settings;
			if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'webhooks' ) ) ) {
				return;
			}
			if ( ! isset( $_REQUEST['_wot_webhooks_nonce'] ) || ! wp_verify_nonce( $_REQUEST['_wot_webhooks_nonce'], 'wot_webhooks_action' ) ) {
				return;
			}
			if ( ! isset( $_POST['wot_save_webhooks_options'] ) || ! $_POST['wot_save_webhooks_options'] ) {
				return;
			}
			$args                 = self::$settings->get_params();
			$service_carrier_type = self::$settings->get_params( 'service_carrier_type' );
			switch ( $service_carrier_type ) {
				case 'trackingmore':
					$args['webhooks_user_email']                            = isset( $_POST['woo_orders_tracking_webhooks_user_email'] )
						? sanitize_email( $_POST['woo_orders_tracking_webhooks_user_email'] ) : '';
					$args[ 'webhooks_send_email_' . $service_carrier_type ] = isset( $_POST[ 'woo_orders_tracking_webhooks_send_email_' . $service_carrier_type ] )
						? stripslashes_deep( $_POST[ 'woo_orders_tracking_webhooks_send_email_' . $service_carrier_type ] ) : array();
					break;
				case 'aftership':
					$args['webhooks_secret']                                = isset( $_POST['woo_orders_tracking_webhooks_secret'] )
						? sanitize_text_field( $_POST['woo_orders_tracking_webhooks_secret'] ) : '';
					$args[ 'webhooks_send_email_' . $service_carrier_type ] = isset( $_POST[ 'woo_orders_tracking_webhooks_send_email_' . $service_carrier_type ] )
						? stripslashes_deep( $_POST[ 'woo_orders_tracking_webhooks_send_email_' . $service_carrier_type ] ) : array();
					break;
				case '17track':
					$args[ 'webhooks_send_email_' . $service_carrier_type ] = isset( $_POST[ 'woo_orders_tracking_webhooks_send_email_' . $service_carrier_type ] )
						? stripslashes_deep( $_POST[ 'woo_orders_tracking_webhooks_send_email_' . $service_carrier_type ] ) : array();
					break;
				case 'easypost':
					$args['webhooks_password']                              = isset( $_POST['woo_orders_tracking_webhooks_password'] )
						? sanitize_text_field( $_POST['woo_orders_tracking_webhooks_password'] ) : '';
					$args[ 'webhooks_send_email_' . $service_carrier_type ] = isset( $_POST[ 'woo_orders_tracking_webhooks_send_email_' . $service_carrier_type ] )
						? stripslashes_deep( $_POST[ 'woo_orders_tracking_webhooks_send_email_' . $service_carrier_type ] ) : array();
					break;
			}
			$args['webhooks_enable']     = isset( $_POST['woo_orders_tracking_webhooks_enable'] ) ? sanitize_text_field( $_POST['woo_orders_tracking_webhooks_enable'] ) : '';
			$args['webhooks_debug']      = isset( $_POST['woo_orders_tracking_webhooks_debug'] ) ? sanitize_text_field( $_POST['woo_orders_tracking_webhooks_debug'] ) : '';
			$args['change_order_status'] = isset( $_POST['woo_orders_tracking_change_order_status'] ) ? sanitize_text_field( $_POST['woo_orders_tracking_change_order_status'] )
				: '';
			update_option( 'woo_orders_tracking_settings', $args );
			$woo_orders_tracking_settings = $args;
			self::$settings               = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance( true );
		}

		/**
		 *
		 */
		public function admin_enqueue_scripts() {
			global $pagenow;
			$page = isset( $_REQUEST['page'] ) ? sanitize_text_field( $_REQUEST['page'] ) : '';// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $pagenow === 'admin.php' && $page === 'woocommerce-orders-tracking-webhooks' ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_SETTINGS::admin_enqueue_semantic();
				if ( ! wp_script_is( 'transition' ) ) {
					wp_enqueue_style( 'transition', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'transition.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
					wp_enqueue_script( 'transition', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'transition.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
				}
				wp_enqueue_style( 'woocommerce-orders-tracking-webhooks', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'webhooks.css','',VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
				wp_enqueue_script( 'woocommerce-orders-tracking-webhooks', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'webhooks.js', array( 'jquery' ),
					VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION,false );
			}
		}

		/**
		 *
		 */
		public function admin_menu() {
			add_submenu_page( 'woocommerce-orders-tracking', esc_html__( 'Webhooks', 'woocommerce-orders-tracking' ), esc_html__( 'Webhooks', 'woocommerce-orders-tracking' ),
				VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'webhooks' ), 'woocommerce-orders-tracking-webhooks', array(
					$this,
					'page_callback'
				) );
		}

		/**
		 *
		 */
		public function page_callback() {
			$service_carrier_type = self::$settings->get_params( 'service_carrier_type' );
			$option_field         = '';
			$webhooks_url         = get_site_url( null, "wp-json/woocommerce-orders-tracking/{$service_carrier_type}" );
			$webhooks_url_desc    = '';
			$statuses             = array();
			?>
            <div class="wrap">
                <h2><?php esc_html_e( 'Webhooks Settings', 'woocommerce-orders-tracking' ) ?></h2>
                <div class="vi-ui segment">
                    <div class="vi-ui positive message">
                        <div class="header"><?php esc_html_e( 'How to setup your webhook?', 'woocommerce-orders-tracking' ); ?></div>
                        <ul class="list">
							<?php
							switch ( $service_carrier_type ) {
								case 'trackingmore':
									$statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::status_text();
									?>
                                    <li><?php echo wp_kses_post(__( 'Go to <a href="https://my.trackingmore.com/webhook_setting.php">https://my.trackingmore.com/webhook_setting.php</a>',
											'woocommerce-orders-tracking' )); ?></li>
                                    <li><?php esc_html_e( 'Copy Webhook url below and paste it to Webhook URL field of your Webhook Notification Settings',
											'woocommerce-orders-tracking' ); ?></li>
                                    <li><?php esc_html_e( 'Select statuses that you want to be notified', 'woocommerce-orders-tracking' ); ?></li>
                                    <li><?php esc_html_e( 'Save', 'woocommerce-orders-tracking' ); ?></li>
									<?php
									ob_start();
									?>
                                    <tr>
                                        <th>
                                            <label for="<?php echo esc_attr( self::set( 'webhooks_user_email' ) ) ?>"><?php esc_html_e( 'TrackingMore Email',
													'woocommerce-orders-tracking' ) ?></label>
                                        </th>
                                        <td>
                                            <input type="email"
                                                   name="<?php echo esc_attr( self::set( 'webhooks_user_email', true ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'webhooks_user_email' ) ) ?>"
                                                   value="<?php echo esc_attr( self::$settings->get_params( 'webhooks_user_email' ) ) ?>">
                                            <div class="description"><?php esc_html_e( 'Email is required to verify webhook from TrackingMore',
													'woocommerce-orders-tracking' ) ?></div>
                                        </td>
                                    </tr>
									<?php
									$option_field = ob_get_clean();
									break;
								case 'aftership':
									$statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::status_text();
									?>
                                    <li><?php echo wp_kses_post(__( 'Go to <a href="https://admin.aftership.com/settings/notifications">Notification settings</a> and scroll down to the bottom of the page',
											'woocommerce-orders-tracking' )); ?></li>
                                    <li><?php esc_html_e( 'Add webhook URL using below Webhook URL', 'woocommerce-orders-tracking' ); ?></li>
                                    <li><?php esc_html_e( 'Copy the AfterShip Webhook secret and paste it to respective Webhook secret field below',
											'woocommerce-orders-tracking' ); ?></li>
                                    <li><?php esc_html_e( 'Select events to start receiving updates.', 'woocommerce-orders-tracking' ); ?></li>
                                    <li><?php esc_html_e( 'Save', 'woocommerce-orders-tracking' ); ?></li>
									<?php
									ob_start();
									?>
                                    <tr>
                                        <th>
                                            <label for="<?php echo esc_attr( self::set( 'webhooks_secret' ) ) ?>"><?php esc_html_e( 'Webhook secret',
													'woocommerce-orders-tracking' ) ?></label>
                                        </th>
                                        <td>
                                            <input type="text"
                                                   name="<?php echo esc_attr( self::set( 'webhooks_secret', true ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'webhooks_secret' ) ) ?>"
                                                   value="<?php echo esc_attr( self::$settings->get_params( 'webhooks_secret' ) ) ?>">
                                            <div class="description"><?php echo wp_kses_post(__( 'Paste your AfterShip Webhook secret here. You can find it in your AfterShip <a href="https://admin.aftership.com/settings/notifications">Notification settings</a>',
													'woocommerce-orders-tracking' )) ?></div>
                                        </td>
                                    </tr>
									<?php
									$option_field = ob_get_clean();
									break;
								case '17track':
									?>
                                    <li><?php echo wp_kses_post(__( 'Copy below webhook URL and paste to WebHook field in <a href="https://api.17track.net/en/admin/settings">17track settings</a>',
											'woocommerce-orders-tracking' )); ?></li>
                                    <li><?php esc_html_e( 'Under Notification settings, select statuses to receive notification when tracking information changes',
											'woocommerce-orders-tracking' ); ?></li>
									<?php
									$statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::status_text();
									break;
								case 'easypost':
									$statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::status_text();
									$webhooks_url_desc = esc_html__( 'Please note that Webhook URL will change if you change Webhook Secret.', 'woocommerce-orders-tracking' );
									$webhooks_url = add_query_arg( array( 'secret_key' => self::$settings->get_params( 'webhooks_password' ) ), $webhooks_url );
									?>
                                    <li><?php echo wp_kses_post(__( 'Go to <a href="https://www.easypost.com/account/webhooks-and-events">Webhooks & Events</a>',
											'woocommerce-orders-tracking' )); ?></li>
                                    <li><?php esc_html_e( 'Add webhook URL using below Webhook URL', 'woocommerce-orders-tracking' ); ?></li>
									<?php
									ob_start();
									?>
                                    <tr>
                                        <th>
                                            <label for="<?php echo esc_attr( self::set( 'webhooks_password' ) ) ?>"><?php esc_html_e( 'Webhook secret',
													'woocommerce-orders-tracking' ) ?></label>
                                        </th>
                                        <td>
                                            <input type="text" required="required"
                                                   name="<?php echo esc_attr( self::set( 'webhooks_password', true ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'webhooks_password' ) ) ?>"
                                                   value="<?php echo esc_attr( self::$settings->get_params( 'webhooks_password' ) ) ?>">
                                            <div class="description"><?php esc_html_e( 'This helps prevent any third parties from masquerading as EasyPost and sending fraudulent data',
													'woocommerce-orders-tracking' ) ?></div>
                                        </td>
                                    </tr>
									<?php
									$option_field = ob_get_clean();
									break;
								default:
									?>
                                    <li><?php esc_html_e( 'Webhook is not available with your currently selected tracking service', 'woocommerce-orders-tracking' ); ?></li>
								<?php
							}
							?>
                        </ul>
                    </div>
					<?php
					if ( self::support_webhooks( $service_carrier_type ) ) {
						?>
                        <form class="vi-ui form" method="post">
							<?php wp_nonce_field( 'wot_webhooks_action', '_wot_webhooks_nonce' ); ?>
                            <table class="form-table">
                                <tbody>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'webhooks_enable' ) ) ?>"><?php esc_html_e( 'Enable webhook',
												'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui toggle checkbox">
                                            <input type="checkbox"
                                                   name="<?php echo esc_attr( self::set( 'webhooks_enable', true ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'webhooks_enable' ) ) ?>"
                                                   value="1" <?php checked( self::$settings->get_params( 'webhooks_enable' ), '1' ) ?>>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'webhooks_debug' ) ) ?>"><?php esc_html_e( 'Enable Debug',
												'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui toggle checkbox">
                                            <input type="checkbox"
                                                   name="<?php echo esc_attr( self::set( 'webhooks_debug', true ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'webhooks_debug' ) ) ?>"
                                                   value="1" <?php checked( self::$settings->get_params( 'webhooks_debug' ), '1' ) ?>>
                                        </div>
                                        <div class="description"><?php esc_html_e( 'If enabled, webhook data will be logged for debugging purpose',
												'woocommerce-orders-tracking' ) ?></div>
                                    </td>
                                </tr>
								<?php
								if ( $option_field ) {
									echo $option_field;
								}
								?>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'webhooks_send_email_' . $service_carrier_type ) ) ?>"><?php esc_html_e( 'Send email',
												'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
										<?php
										$webhooks_send_email = self::$settings->get_params( 'webhooks_send_email_' . $service_carrier_type );
										?>
                                        <select id="<?php echo esc_attr( self::set( 'webhooks_send_email_' . $service_carrier_type ) ) ?>"
                                                class="vi-ui fluid dropdown"
                                                name="<?php echo esc_attr( self::set( 'webhooks_send_email_' . $service_carrier_type, true ) ) ?>[]"
                                                multiple="multiple">
											<?php
											foreach ( $statuses as $status_k => $status_v ) {
												?>
                                                <option value="<?php echo esc_attr( $status_k ) ?>" <?php if ( in_array( $status_k, $webhooks_send_email ) ) {
													echo esc_attr( 'selected' );
												} ?>><?php echo esc_html( $status_v ) ?></option>
												<?php
											}
											?>
                                        </select>
                                        <div class="description"><?php echo wp_kses_post(__( 'Send email to customers if Shipment status changes to one of these values. View <a href="admin.php?page=woocommerce-orders-tracking#email" target="_blank">Email settings</a>.',
												'woocommerce-orders-tracking' )) ?></div>
                                        <div class="description"><?php echo wp_kses_post(__( '<strong>*Note: </strong>Statuses you select here must be selected in your Webhook settings',
												'woocommerce-orders-tracking' )) ?></div>
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label><?php esc_html_e( 'Webhook URL', 'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui fluid right labeled input <?php echo esc_attr( self::set( 'webhooks-url-container' ) ) ?>">
                                            <input type="text" readonly
                                                   class="<?php echo esc_attr( self::set( 'webhooks-url' ) ) ?>"
                                                   value="<?php echo esc_url( $webhooks_url ) ?>">
                                            <i class="check green icon"></i>
                                            <label class="vi-ui label"><span
                                                        class="vi-ui small positive button <?php echo esc_attr( self::set( 'webhooks-url-copy' ) ) ?>"><?php esc_html_e( 'Copy',
														'woocommerce-orders-tracking' ) ?></span></label>
                                        </div>
										<?php
										if ( $webhooks_url_desc ) {
											?>
                                            <p class="description"><?php echo wp_kses_post($webhooks_url_desc) ?></p>
											<?php
										}
										?>
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            <p>
                                <input type="submit" class="vi-ui button primary" name="wot_save_webhooks_options"
                                       value="<?php esc_html_e( 'Save', 'woocommerce-orders-tracking' ) ?> "/>
                            </p>
                        </form>
						<?php
					}
					?>
                </div>
            </div>
			<?php
		}

		private static function support_webhooks( $service_carrier_type ) {
			return in_array( $service_carrier_type, array( 'trackingmore', '17track', 'aftership', 'easypost' ), true );
		}

		public static function map_statuses_table( $service_carrier_type ) {
			ob_start();
			$map_statuses = array();
			$title        = '';
			switch ( $service_carrier_type ) {
				case 'trackingmore':
					$map_statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::map_statuses();
					$title        = esc_html__( 'TrackingMore Status', 'woocommerce-orders-tracking' );
					break;
				case 'aftership':
					$map_statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::map_statuses();
					$title        = esc_html__( 'AfterShip Status', 'woocommerce-orders-tracking' );
					break;
				case 'easypost':
					$map_statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::map_statuses();
					$title        = esc_html__( 'EasyPost Status', 'woocommerce-orders-tracking' );
					break;
				default:
			}
			?>
            <table class="vi-ui celled table center aligned <?php echo esc_attr( self::set( 'map-statuses' ) ) ?>">
                <thead>
                <tr>
                    <th><?php echo wp_kses_post($title); ?></th>
                    <th><?php esc_html_e( 'Converted Status', 'woocommerce-orders-tracking' ) ?></th>
                </tr>
                </thead>
                <tbody>
				<?php
				foreach ( $map_statuses as $from => $to ) {
					?>
                    <tr>
                        <td><?php echo esc_html( ucwords( str_replace( '_', ' ', $from ) ) ) ?></td>
                        <td><?php echo esc_html( self::$settings->get_status_text_by_service_carrier( $to ) ) ?></td>
                    </tr>
					<?php
				}
				?>
                </tbody>
            </table>
			<?php
			return ob_get_clean();
		}

		/**
		 * Register REST API for Webhook
		 */
		public function register_api() {
			if ( self::$settings->get_params( 'service_carrier_enable' ) ) {
				$service_carrier_type = self::$settings->get_params( 'service_carrier_type' );
				if ( $service_carrier_type !== 'cainiao' ) {
					register_rest_route(
						'woocommerce-orders-tracking', "/{$service_carrier_type}", array(
							'methods'             => 'POST',
							'callback'            => array( $this, "webhook_{$service_carrier_type}" ),
							'permission_callback' => '__return_true',
						)
					);
				}
			}
		}

		/**
		 * @param $request WP_REST_Request
		 *
		 * @throws Exception
		 */
		public function webhook_trackingmore( $request ) {
			$input_json = $request->get_body();
			$user_email = self::$settings->get_params( 'webhooks_user_email' );
			$send_email = self::$settings->get_params( 'webhooks_send_email_trackingmore' );
			if ( self::$settings->get_params( 'webhooks_enable' ) ) {
				self::debug_log( 'webhook_trackingmore' );
				self::debug_log( $input_json );
				$input = vi_wot_json_decode( $input_json );
				if ( isset( $input['verify'] ) ) {
					/*API v3*/
					$timeStr   = isset( $input['verify']['timestamp'] ) ? sanitize_text_field( $input['verify']['timestamp'] ) : '';
					$signature = isset( $input['verify']['signature'] ) ? sanitize_text_field( $input['verify']['signature'] ) : '';
				} elseif ( isset( $input['verifyInfo'] ) ) {
					/*API v2*/
					$timeStr   = isset( $input['verifyInfo']['timeStr'] ) ? sanitize_text_field( $input['verifyInfo']['timeStr'] ) : '';
					$signature = isset( $input['verifyInfo']['signature'] ) ? sanitize_text_field( $input['verifyInfo']['signature'] ) : '';
				} else {
					$header = $request->get_headers();
					self::debug_log( var_export( $header, true ) );
					$timeStr   = isset( $header['timestamp'] ) ? sanitize_text_field( $header['timestamp'] ) : '';
					$signature = isset( $header['signature'] ) ? sanitize_text_field( $header['signature'] ) : '';
				}
				if ( $timeStr && $signature ) {
					if ( self::verify_trackingmore( $timeStr, $user_email, $signature ) ) {
						if ( isset( $input['data'] ) && is_array( $input['data'] ) && count( $input['data'] ) ) {
							$tracking        = $input['data'];
							$tracking_number = isset( $tracking['tracking_number'] ) ? $tracking['tracking_number'] : '';
							$carrier_id      = isset( $tracking['courier_code'] ) ? $tracking['courier_code']
								: ( isset( $tracking['carrier_code'] ) ? $tracking['carrier_code'] : '' );
							if ( $tracking_number && $carrier_id ) {
								$track_info = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::process_trackinfo( $tracking );
								if ( $track_info ) {
									$track_info = vi_wot_json_encode( $track_info );
								} else {
									$track_info = '';
								}
								$last_event     = isset( $tracking['latest_event'] ) ? $tracking['latest_event']
									: ( isset( $tracking['lastEvent'] ) ? $tracking['lastEvent'] : '' );
								$status         = isset( $tracking['delivery_status'] ) ? $tracking['delivery_status']
									: ( isset( $tracking['status'] ) ? $tracking['status'] : '' );
								$convert_status = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $status );
								$carrier_slug   = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::get_carrier_slug_by_trackingmore_slug( $carrier_id );
								if ( $carrier_slug ) {
									$results = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::search_order_item_by_tracking_number( $tracking_number, '', '', $carrier_slug, false );
									if ( count( $results ) ) {
										$order_ids         = array_unique( array_column( $results, 'order_id' ) );
										$changed_order_ids = array();
										$order_item_ids    = array();
										foreach ( $results as $result ) {
											if ( $result['order_item_id'] ) {
												$item_tracking_data = vi_wot_json_decode( $result['meta_value'] );
												if ( $result['meta_key'] === '_vi_wot_order_item_tracking_data' ) {
													$order_item_ids[]                     = $result['order_item_id'];
													$current_tracking_data                = array_pop( $item_tracking_data );
													$current_tracking_data['status']      = $status;
													$current_tracking_data['last_update'] = time();
													$item_tracking_data[]                 = $current_tracking_data;
													wc_update_order_item_meta( $result['order_item_id'], '_vi_wot_order_item_tracking_data',
														vi_wot_json_encode( $item_tracking_data ) );
												} elseif ( $result['meta_key'] === '_vi_wot_order_item_tracking_data_by_quantity' ) {
													foreach ( $item_tracking_data as $quantity_index => &$current_tracking_data ) {
														if ( $current_tracking_data['tracking_number'] == $tracking_number
														     && $current_tracking_data['carrier_slug'] === $result['carrier_slug']
														) {
															$order_item_ids[]                     = $result['order_item_id'] . '_' . $quantity_index;
															$current_tracking_data['status']      = $status;
															$current_tracking_data['last_update'] = time();
														}
													}
													wc_update_order_item_meta( $result['order_item_id'], '_vi_wot_order_item_tracking_data_by_quantity',
														vi_wot_json_encode( $item_tracking_data ) );
												}
											} else {
												$changed_order_ids[] = $result['order_id'];
												$order_t             = wc_get_order( $result['order_id'] );
												$order_t->update_meta_data( '_wot_tracking_status', $status );
												$order_t->save_meta_data();
											}
										}
										$changed_order_ids = array_unique( $changed_order_ids );
										$order_item_ids    = array_unique( $order_item_ids );
										$log               = '';
										self::update_order_status( $tracking_number, $convert_status, $order_ids, $order_item_ids, $changed_order_ids, $log );
										do_action_ref_array( 'woo_orders_tracking_webhook_handle_shipment_status', array(
											$tracking_number,
											$status,
											$order_ids,
											$order_item_ids,
											&$log,
											'trackingmore',
											$changed_order_ids
										) );
										if ( ! $log ) {
											$log = sprintf(  'New status received for tracking number %s: %s', $tracking_number, $convert_status );
										}
										self::send_email_based_on_status( $send_email, $status, $order_ids, $log );
										self::wc_log( $log );
										if ( ! VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::update_by_tracking_number( $tracking_number, $status, $carrier_slug, false, false,
											$track_info, $last_event )
										) {
											foreach ( $order_ids as $order_id ) {
												VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, $status, $carrier_slug, '',
													VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $last_event, '' );
											}
										}
									} else {
										self::wc_log( esc_html( 'Missing tracking number on your database. Please add tracking to the order before receiving data from webhook: ' . $carrier_id), WC_Log_Levels::WARNING );
									}
								} else {
									self::wc_log( esc_html('TrackingMore carrier slug not found: ' . $carrier_id), WC_Log_Levels::WARNING );
								}
							} else {
								self::wc_log(  'Invalid tracking number: '. vi_wot_json_encode( $tracking ), WC_Log_Levels::WARNING );
							}
						} else {
							self::wc_log( 'Invalid data: ' . $input_json, WC_Log_Levels::WARNING );
						}
					} else {
						self::wc_log( esc_html( 'Cannot verify webhook'), WC_Log_Levels::WARNING );
					}
				} else {
					self::wc_log( esc_html( 'Missing verification params' ), WC_Log_Levels::WARNING );
				}
			} else {
				self::wc_log( esc_html( 'Webhook is currently disabled' ), WC_Log_Levels::NOTICE );
			}
		}

		/**
		 * @param $request WP_REST_Request
		 *
		 * @throws Exception
		 */
		public function webhook_17track( $request ) {
			$tracking_service        = '17track';
			$input_json              = $request->get_body();
			$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
			if ( !self::$settings->get_params( 'webhooks_enable' ) ) {
				self::wc_log( esc_html( 'Webhook is currently disabled' ), WC_Log_Levels::NOTICE );
                return;
			}
			$input     = vi_wot_json_decode( $input_json );
			$signature = $request->get_header( 'sign' );//sign is moved to header in v2
			$v2        = true;
			if ( ! $signature ) {
				$v2 = false;
				if ( isset( $input['sign'] ) ) {
					$signature = sanitize_text_field( $input['sign'] );
				}
			}
			$event = isset( $input['event'] ) ? sanitize_text_field( $input['event'] ) : '';
			$data  = isset( $input['data'] ) ? $input['data'] : array();
			if ( !$service_carrier_api_key || !$signature || !$event || !$data ) {
				self::wc_log( esc_html( 'Missing verification params' ), WC_Log_Levels::WARNING );
                ob_start();
                var_dump('$signature: '.$signature);
                var_dump('$event: '.$event);
                var_dump($data);
                self::wc_log( ob_get_clean(), WC_Log_Levels::WARNING );
                return;
			}
            if (!self::verify_17track( $service_carrier_api_key, $signature, $event, $data, $v2 )){
	            self::wc_log( esc_html( 'Cannot verify webhook' ), WC_Log_Levels::WARNING );
	            ob_start();
	            var_dump('$signature: '.$signature);
	            var_dump('$event: '.$event);
	            var_dump($data);
	            self::wc_log( ob_get_clean(), WC_Log_Levels::WARNING );
                return;
            }
			$tracking_number = isset( $data['number'] ) ? $data['number'] : '';
			if ( $event === 'TRACKING_UPDATED' ) {
				if ( $v2 ) {
					self::handle_data_17track( '', $tracking_number, $data, $tracking_service );
				} else {
					/*v1*/
					$track = $data['track'];
					if ( $track['w1'] ) {
						self::handle_data_17track( 1, $tracking_number, $track, $tracking_service, false );
					}
					if ( $track['w2'] ) {
						self::handle_data_17track( 2, $tracking_number, $track, $tracking_service, false );
					}
				}
			} elseif ( $event === 'TRACKING_STOPPED' ) {
				self::wc_log( esc_html( 'Tracking number stops updating: '.$tracking_number ), WC_Log_Levels::WARNING );
			} else {
                ob_start();
                var_dump('Invalid event: ' . $event);
				print_r(wp_json_encode($input));
				self::wc_log( ob_get_clean(), WC_Log_Levels::WARNING );
			}
		}

		/**
		 * @param      $carrier_no
		 * @param      $tracking_number
		 * @param      $track
		 * @param      $tracking_service
		 * @param bool $v2
		 *
		 * @throws Exception
		 */
		private static function handle_data_17track( $carrier_no, $tracking_number, $track, $tracking_service, $v2 = true ) {
			$carrier_id    = $v2 ? $track['carrier'] : $track["w{$carrier_no}"];
			$carrier_slugs = VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::get_original_carrier_slug( $carrier_id );
            if (!is_array($carrier_slugs) || empty($carrier_slugs)){
	            self::wc_log( esc_html( 'Carrier not found' ), WC_Log_Levels::WARNING );
                return;
            }
			$results = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::search_order_item_by_tracking_number( $tracking_number, '', '', '', false );
            if (empty($results)){
	            self::wc_log( esc_html( 'Tracking number not found'), WC_Log_Levels::WARNING );
                return;
            }
			if ( $v2 ) {
				$track_info = VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::get_track_info( $track['track_info']['tracking'], true,
					isset( $track['track_info']['latest_status']['status'] ) ? $track['track_info']['latest_status']['status'] : '' );
				$last_event = '';
				if ( $track_info ) {
					$last_event = $track_info[0]['description'];
					$status     = $track_info[0]['status'];

					$track_info = vi_wot_json_encode( $track_info );
				} else {
					$track_info = '';
					$status     = '';
				}
				$original_country = isset( $track['track_info']['shipping_info']['shipper_address']['country'] )
					? $track['track_info']['shipping_info']['shipper_address']['country'] : '';
				$dest_country     = isset( $track['track_info']['shipping_info']['recipient_address']['country'] )
					? $track['track_info']['shipping_info']['recipient_address']['country'] : '';
			} else {
				$track_info = VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::get_track_info( $track["z$carrier_no}"], false );
				$last_event = '';
				if ( $track_info ) {
					$last_event = $track_info[0]['description'];

					$track_info = vi_wot_json_encode( $track_info );
				} else {
					$track_info = '';
				}
				$status           = VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::convert_v1_statuses( $track['e'] );
				$original_country = $track['b'] ? VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::get_country_code( $track['b'], false ) : '';
				$dest_country     = $track['c'] ? VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::get_country_code( $track['c'], false ) : '';
			}
			self::handle_found_items( $tracking_service, $tracking_number, $status, $carrier_slugs, $results, $order_ids_by_carriers );
            if (!empty($order_ids_by_carriers)) {
	            foreach ( $order_ids_by_carriers as $carrier_slug => $order_ids_by_carrier ) {
		            if ( ! VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update_by_tracking_number( $tracking_number, $carrier_slug, $tracking_service, $status, $track_info,
			            $last_event, '', $original_country, $dest_country )
		            ) {
			            foreach ( $order_ids_by_carrier as $order_id ) {
				            VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $tracking_service, $status, $track_info,
					            $last_event, '', '', $original_country, $dest_country );
			            }
		            }
	            }
            }
		}

		/**
		 * @param $request WP_REST_Request
		 *
		 * @throws Exception
		 */
		public function webhook_aftership( $request ) {
			$tracking_service = 'aftership';
			$input_json       = $request->get_body();
			$webhooks_secret  = self::$settings->get_params( 'webhooks_secret' );
			$hmac_header      = $request->get_header( 'aftership-hmac-sha256' );
			if ( self::$settings->get_params( 'webhooks_enable' ) ) {
				self::debug_log( $input_json );
				$input = vi_wot_json_decode( $input_json );
				if ( self::verify_aftership( $input_json, $hmac_header, $webhooks_secret ) ) {
					if ( isset( $input['msg'] ) && is_array( $input['msg'] ) && count( $input['msg'] ) ) {
						$tracking        = $input['msg'];
						$tracking_number = isset( $tracking['tracking_number'] ) ? $tracking['tracking_number'] : '';
						if ( $tracking_number ) {
							$track_info = VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::get_track_info( $tracking['checkpoints'] );
							$last_event = '';
							if ( $track_info ) {
								$last_event = $track_info[0]['description'];
								$track_info = vi_wot_json_encode( $track_info );
							} else {
								$track_info = '';
							}
							$status        = $tracking['tag'];
							$carrier_id    = $tracking['slug'];
							$carrier_slugs = VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::get_original_carrier_slug( $carrier_id );
							if ( count( $carrier_slugs ) ) {
								$results = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::search_order_item_by_tracking_number( $tracking_number, '', '', '', false );
								if ( count( $results ) ) {
									self::handle_found_items( $tracking_service, $tracking_number, $status, $carrier_slugs, $results, $order_ids_by_carriers );
									foreach ( $order_ids_by_carriers as $carrier_slug => $order_ids_by_carrier ) {
										if ( ! VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update_by_tracking_number( $tracking_number, $carrier_slug, $tracking_service,
											$status, $track_info, $last_event, $tracking['expected_delivery'], $tracking['origin_country_iso3'],
											$tracking['destination_country_iso3'] )
										) {
											foreach ( $order_ids_by_carrier as $order_id ) {
												VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $tracking_service, $status,
													$track_info, $last_event, $tracking['expected_delivery'], false, $tracking['origin_country_iso3'],
													$tracking['destination_country_iso3'] );
											}
										}
									}
								}
							} else {
								self::wc_log( esc_html( 'No data' ), WC_Log_Levels::WARNING );
							}
						} else {
							self::wc_log( esc_html( 'Invalid tracking number' ), WC_Log_Levels::WARNING );
						}
					}
				} else {
					self::wc_log( esc_html( 'Cannot verify webhook' ), WC_Log_Levels::WARNING );
				}
			} else {
				self::wc_log( esc_html( 'Webhook is currently disabled' ), WC_Log_Levels::NOTICE );
			}
		}

		/**
		 * @param $request WP_REST_Request
		 *
		 * @throws Exception
		 */
		public function webhook_easypost( $request ) {
			$tracking_service  = 'easypost';
			$input_json        = $request->get_body();
			$secret            = $request->get_param( 'secret_key' );
			$webhooks_password = self::$settings->get_params( 'webhooks_password' );
			if ( self::$settings->get_params( 'webhooks_enable' ) ) {
				self::debug_log( $input_json );
				if ( $secret && $secret === $webhooks_password ) {
					$input = vi_wot_json_decode( $input_json );
					$event = isset( $input['description'] ) ? sanitize_text_field( $input['description'] ) : '';
					if ( ( $event === 'tracker.created' || $event === 'tracker.updated' ) && isset( $input['result'] ) && is_array( $input['result'] )
					     && count( $input['result'] )
					) {
						$tracking        = $input['result'];
						$tracking_number = isset( $tracking['tracking_code'] ) ? $tracking['tracking_code'] : '';
						if ( $tracking_number ) {
							$track_info = VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::get_track_info( $tracking['tracking_details'] );
							$last_event = '';
							if ( $track_info ) {
								$last_event = $track_info[0]['description'];
								$track_info = vi_wot_json_encode( $track_info );
							} else {
								$track_info = '';
							}
							$status        = $tracking['status'];
							$carrier_id    = $tracking['carrier'];
							$carrier_slugs = VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::get_original_carrier_slug( $carrier_id );
							if ( count( $carrier_slugs ) ) {
								$results = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::search_order_item_by_tracking_number( $tracking_number, '', '', '', false );
								if ( count( $results ) ) {
									self::handle_found_items( $tracking_service, $tracking_number, $status, $carrier_slugs, $results, $order_ids_by_carriers );
									foreach ( $order_ids_by_carriers as $carrier_slug => $order_ids_by_carrier ) {
										if ( ! VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update_by_tracking_number( $tracking_number, $carrier_slug, $tracking_service,
											$status, $track_info, $last_event, $tracking['est_delivery_date'] )
										) {
											foreach ( $order_ids_by_carrier as $order_id ) {
												VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $tracking_service, $status,
													$track_info, $last_event, $tracking['est_delivery_date'] );
											}
										}
									}
								}
							} else {
								self::wc_log( esc_html( 'No data'), WC_Log_Levels::WARNING );
							}
						} else {
							self::wc_log( esc_html( 'Invalid tracking number'), WC_Log_Levels::WARNING );
						}
					}
				} else {
					self::wc_log( esc_html( 'Cannot verify webhook'), WC_Log_Levels::WARNING );
				}
			} else {
				self::wc_log( esc_html( 'Webhook is currently disabled' ), WC_Log_Levels::NOTICE );
			}
		}

		/**
		 * @param $tracking_service
		 * @param $tracking_number
		 * @param $status
		 * @param $carrier_slugs
		 * @param $results
		 * @param $order_ids_by_carriers
		 *
		 * @throws Exception
		 */
		private static function handle_found_items( $tracking_service, $tracking_number, $status, $carrier_slugs, $results, &$order_ids_by_carriers ) {
			$send_email            = self::$settings->get_params( "webhooks_send_email_{$tracking_service}" );
			$order_ids_by_carriers = array();
			$changed_order_ids     = $order_sends= array();
			$order_item_ids        = array();
			foreach ( $results as $key => $result ) {
				if ( in_array( $result['carrier_slug'], $carrier_slugs ) ) {
					if ( ! isset( $order_ids_by_carriers[ $result['carrier_slug'] ] ) ) {
						$order_ids_by_carriers[ $result['carrier_slug'] ] = array();
					}
					$order_ids_by_carriers[ $result['carrier_slug'] ][] = $result['order_id'];
					if ( $result['order_item_id'] ) {
						$item_tracking_data = vi_wot_json_decode( $result['meta_value'] );
						if ( $result['meta_key'] === '_vi_wot_order_item_tracking_data' ) {
							$order_item_ids[]                     = $result['order_item_id'];
							$current_tracking_data                = array_pop( $item_tracking_data );
                            if ($current_tracking_data['status'] !== $status) {
	                            $order_sends[]=$result['order_id'];
	                            $current_tracking_data['status']      = $status;
                            }
							$current_tracking_data['last_update'] = time();
							$item_tracking_data[]                 = $current_tracking_data;
							wc_update_order_item_meta( $result['order_item_id'], '_vi_wot_order_item_tracking_data', vi_wot_json_encode( $item_tracking_data ) );
						} elseif ( $result['meta_key'] === '_vi_wot_order_item_tracking_data_by_quantity' ) {
							foreach ( $item_tracking_data as $quantity_index => &$current_tracking_data ) {
								if ( $current_tracking_data['tracking_number'] == $tracking_number && $current_tracking_data['carrier_slug'] === $result['carrier_slug'] ) {
									$order_item_ids[]                     = $result['order_item_id'] . '_' . $quantity_index;
									if ($current_tracking_data['status'] !== $status) {
										$order_sends[]=$result['order_id'];
										$current_tracking_data['status']      = $status;
									}
									$current_tracking_data['last_update'] = time();
								}
							}
							wc_update_order_item_meta( $result['order_item_id'], '_vi_wot_order_item_tracking_data_by_quantity', vi_wot_json_encode( $item_tracking_data ) );
						}
					} else {
						$changed_order_ids[] = $result['order_id'];
						$order_t             = wc_get_order( $result['order_id'] );
                        $old_status = $order_t->get_meta('_wot_tracking_status');
                        if ($old_status != $status) {
	                        $order_sends[]=$result['order_id'];
	                        $order_t->update_meta_data( '_wot_tracking_status', $status );
	                        $order_t->save_meta_data();
                        }
					}
				} else {
					unset( $results[ $key ] );
				}
			}
			$order_ids         = array_unique( array_column( $results, 'order_id' ) );
			$changed_order_ids = array_unique( $changed_order_ids );
			$order_item_ids    = array_unique( $order_item_ids );
			$log               = '';
			$convert_status    = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $status );
			self::update_order_status( $tracking_number, $convert_status, $order_ids, $order_item_ids, $changed_order_ids, $log );
			do_action_ref_array( 'woo_orders_tracking_webhook_handle_shipment_status', array(
				$tracking_number,
				$status,
				$order_ids,
				$order_item_ids,
				&$log,
				$tracking_service,
				$changed_order_ids,
			) );
			if ( ! $log ) {
				switch ( $tracking_service ) {
					case 'trackingmore':
						$shipment_statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::status_text();
						break;
					case 'aftership':
						$shipment_statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::status_text();
						break;
					case '17track':
						$shipment_statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::status_text();
						break;
					case 'easypost':
						$shipment_statuses = VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::status_text();
						break;
					default:
						$shipment_statuses = array();
				}
				$log = sprintf(  'New status received for tracking number %s: %s', $tracking_number, ( isset( $shipment_statuses[ $status ] ) ? $shipment_statuses[ $status ] : $status ) );
			}
			self::send_email_based_on_status( $send_email, $status, array_unique($order_sends), $log );
			self::wc_log( $log );
		}

		/**
		 * @param $tracking_number
		 * @param $convert_status
		 * @param $order_ids
		 * @param $order_item_ids
		 * @param $changed_order_ids
		 * @param $log
		 *
		 * @throws Exception
		 */
		private static function update_order_status( $tracking_number, $convert_status, $order_ids, $order_item_ids, $changed_order_ids, &$log ) {
			$change_order_status = self::$settings->get_params( 'change_order_status' );
			$changed_orders      = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::update_order_status( $convert_status, $order_ids, $order_item_ids, $change_order_status,
				'delivered', $changed_order_ids );
			if ( count( $changed_orders ) ) {
				$wc_order_statuses = wc_get_order_statuses();
				$new_order_status  = isset( $wc_order_statuses[ $change_order_status ] ) ? $wc_order_statuses[ $change_order_status ] : $change_order_status;
				$log               .= sprintf( ngettext( 'New status received for tracking number %s: %s, order %s status changed to %s',
					'New status received for tracking number %s: %s, orders %s status changed to %s', count( $changed_orders ) ), $tracking_number,
					$convert_status, implode( ', ', $changed_orders ), $new_order_status );
			}
		}

		/**
		 * @param $send_email
		 * @param $status
		 * @param $order_ids
		 * @param $log
		 *
		 * @return array
		 * @throws Exception
		 */
		public static function send_email_based_on_status( $send_email, $status, $order_ids, &$log ) {
			$sent_emails = array();
			if ( $send_email && is_array($order_ids) && !empty($order_ids) && in_array( strtolower( $status ), $send_email ) ) {
				foreach ( $order_ids as $order_id ) {
					if ( VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order_id, array(), true ) ) {
						$sent_emails[] = $order_id;
					}
				}
				if ( count( $sent_emails ) ) {
					$log .= PHP_EOL . sprintf( ngettext( 'Email sent for order %s', 'Email sent for orders %s', count( $sent_emails ) ), implode( ', ', $sent_emails ) );
				}
			}

			return $sent_emails;
		}

		/**
		 * Verify Webhook for TrackingMore
		 *
		 * @param $timeStr
		 * @param $useremail
		 * @param $signature
		 *
		 * @return int
		 */
		public static function verify_trackingmore( $timeStr, $useremail, $signature ) {
			$result = hash_hmac( 'sha256', $timeStr, $useremail );

			return strcmp( $result, $signature ) == 0 ? 1 : 0;
		}

		/**
		 * Verify Webhook for 17track
		 *
		 * @param $service_carrier_api_key
		 * @param $signature
		 * @param $event
		 * @param $data
		 * @param $v2
		 *
		 * @return int
		 */
		public static function verify_17track( $service_carrier_api_key, $signature, $event, $data, $v2 ) {
			$data   = vi_wot_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
			$result = hash( 'sha256', $v2 ? '{"event":"' . $event . '","data":' . $data . '}' . "/$service_carrier_api_key" : "$event/$data/$service_carrier_api_key" );

			return strcmp( $result, $signature ) == 0 ? 1 : 0;
		}

		/**
		 * Verify Webhook for aftership
		 *
		 * @param $data
		 * @param $hmac_header
		 * @param $shared_secret
		 *
		 * @return bool
		 */
		public static function verify_aftership( $data, $hmac_header, $shared_secret ) {
			$calculated_hmac = base64_encode( hash_hmac( 'sha256', $data, $shared_secret, true ) );

			return hash_equals( $hmac_header, $calculated_hmac );
		}

		public static function set( $name, $set_name = false ) {
			return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
		}

		/**
		 * @param        $content
		 * @param string $level
		 * @param string $source
		 */
		private static function wc_log( $content, $level = 'info', $source = '' ) {
			VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_LOG::wc_log( $content, $source ? 'webhooks-' . $source : 'webhooks', $level );
		}

		/**
		 * Log webhooks data if debug is enabled
		 *
		 * @param $content
		 */
		private static function debug_log( $content ) {
			if ( self::$settings->get_params( 'webhooks_debug' ) ) {
				self::wc_log( $content, 'debug', 'debug' );
			}
		}
	}
}