<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_CRON_UPDATE_TRACKING' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_CRON_UPDATE_TRACKING {
		protected $settings;
		protected $carriers;
		protected $next_schedule;

		public function __construct() {
			$this->settings      = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			$this->next_schedule = wp_next_scheduled( 'woo_orders_tracking_cron_update_tracking' );
			add_action( 'admin_init', array( $this, 'save_options' ) );
			add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
			add_action( 'admin_menu', array( $this, 'admin_menu' ), 16 );
			add_action( 'woo_orders_tracking_cron_update_tracking', array( $this, 'cron_update_tracking' ) );
			add_filter( 'cron_schedules', array( $this, 'cron_schedules' ) );
		}

		private static function set( $name, $set_name = false ) {
			return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
		}

		public function cron_schedules( $schedules ) {
			$schedules['woo_orders_tracking_cron_update_tracking_interval'] = array(
				'interval' => 86400 * absint( $this->settings->get_params( 'cron_update_tracking_interval' ) ),
				'display'  => esc_html__( 'Cron Update', 'woocommerce-orders-tracking' ),
			);

			return $schedules;
		}

		public function admin_menu() {
			add_submenu_page( 'woocommerce-orders-tracking', esc_html__( 'Schedule Update', 'woocommerce-orders-tracking' ), esc_html__( 'Schedule Update', 'woocommerce-orders-tracking' ), VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'schedule_update' ), 'woocommerce-orders-tracking-cron-update-tracking', array(
				$this,
				'page_callback'
			) );
		}

		public function page_callback() {
			$service_carrier_type = $this->settings->get_params( 'service_carrier_type' );
			?>
            <div class="wrap">
                <h2><?php esc_html_e( 'Schedule Update for tracking number', 'woocommerce-orders-tracking' ) ?></h2>
				<?php
				if ( $service_carrier_type !== 'cainiao' ) {
					?>
                    <form class="vi-ui form" method="post">
						<?php
						wp_nonce_field( 'wot_cron_update_tracking', 'wot_cron_update_tracking_nonce' );
						?>
                        <div class="vi-ui segment">
							<?php
							if ( $this->next_schedule ) {
								$gmt_offset = intval( get_option( 'gmt_offset' ) );
								?>
                                <div class="vi-ui positive message"><?php echo  wp_kses_post(sprintf(__( 'Next schedule: <strong>%s</strong>', 'woocommerce-orders-tracking' ), date_i18n( 'F j, Y g:i:s A', ( $this->next_schedule + HOUR_IN_SECONDS * $gmt_offset ) )) ); // phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment ?></div>
								<?php
							} else {
								?>
                                <div class="vi-ui negative message"><?php esc_html_e( 'Schedule Update is currently DISABLED', 'woocommerce-orders-tracking' );; ?></div>
								<?php
							}
							?>
                            <table class="form-table">
                                <tbody>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'cron_update_tracking' ) ) ?>"><?php esc_html_e( 'Enable cron', 'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui toggle checkbox checked">
                                            <input type="checkbox"
                                                   name="<?php echo esc_attr( self::set( 'cron_update_tracking', true ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'cron_update_tracking' ) ) ?>"
                                                   value="1" <?php checked( $this->settings->get_params( 'cron_update_tracking' ), '1' ) ?>>
                                            <label for="<?php echo esc_attr( self::set( 'cron_update_tracking' ) ) ?>"><?php esc_html_e( 'Schedule to update latest data for all tracking numbers', 'woocommerce-orders-tracking' ) ?></label>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'cron_update_tracking_interval' ) ) ?>"><?php esc_html_e( 'Run update every', 'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui right labeled input">
                                            <input type="number" min="1"
                                                   name="<?php echo esc_attr( self::set( 'cron_update_tracking_interval', true ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'cron_update_tracking_interval' ) ) ?>"
                                                   value="<?php echo esc_attr( $this->settings->get_params( 'cron_update_tracking_interval' ) ) ?>">
                                            <label for="<?php echo esc_attr( self::set( 'cron_update_tracking_interval' ) ) ?>"
                                                   class="vi-ui label"><?php esc_html_e( 'Day(s)', 'woocommerce-orders-tracking' ) ?></label>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'cron_update_tracking_hour' ) ) ?>"><?php esc_html_e( 'Run update at', 'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="equal width fields">
                                            <div class="field">
                                                <div class="vi-ui left labeled input">
                                                    <label for="<?php echo esc_attr( self::set( 'cron_update_tracking_hour' ) ) ?>"
                                                           class="vi-ui label"><?php esc_html_e( 'Hour', 'woocommerce-orders-tracking' ) ?></label>
                                                    <input type="number" min="0" max="23"
                                                           name="<?php echo esc_attr( self::set( 'cron_update_tracking_hour', true ) ) ?>"
                                                           id="<?php echo esc_attr( self::set( 'cron_update_tracking_hour' ) ) ?>"
                                                           value="<?php echo esc_attr( $this->settings->get_params( 'cron_update_tracking_hour' ) ) ?>">
                                                </div>
                                            </div>
                                            <div class="field">
                                                <div class="vi-ui left labeled input">
                                                    <label for="<?php echo esc_attr( self::set( 'cron_update_tracking_minute' ) ) ?>"
                                                           class="vi-ui label"><?php esc_html_e( 'Minute', 'woocommerce-orders-tracking' ) ?></label>
                                                    <input type="number" min="0" max="59"
                                                           name="<?php echo esc_attr( self::set( 'cron_update_tracking_minute', true ) ) ?>"
                                                           id="<?php echo esc_attr( self::set( 'cron_update_tracking_minute' ) ) ?>"
                                                           value="<?php echo esc_attr( $this->settings->get_params( 'cron_update_tracking_minute' ) ) ?>">
                                                </div>
                                            </div>
                                            <div class="field">
                                                <div class="vi-ui left labeled input">
                                                    <label for="<?php echo esc_attr( self::set( 'cron_update_tracking_second' ) ) ?>"
                                                           class="vi-ui label"><?php esc_html_e( 'Second', 'woocommerce-orders-tracking' ) ?></label>
                                                    <input type="number" min="0" max="59"
                                                           name="<?php echo esc_attr( self::set( 'cron_update_tracking_second', true ) ) ?>"
                                                           id="<?php echo esc_attr( self::set( 'cron_update_tracking_second' ) ) ?>"
                                                           value="<?php echo esc_attr( $this->settings->get_params( 'cron_update_tracking_second' ) ) ?>">
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label for="<?php echo esc_attr( self::set( 'cron_update_tracking_range' ) ) ?>"><?php esc_html_e( 'Only query tracking created in the last x day(s):', 'woocommerce-orders-tracking' ) ?></label>
                                    </th>
                                    <td>
                                        <div class="vi-ui right labeled input">
                                            <input type="number" min="1" max=""
                                                   name="<?php echo esc_attr( self::set( 'cron_update_tracking_range', true ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'cron_update_tracking_range' ) ) ?>"
                                                   value="<?php echo esc_attr( $this->settings->get_params( 'cron_update_tracking_range' ) ) ?>">
                                            <label for="<?php echo esc_attr( self::set( 'cron_update_tracking_range' ) ) ?>"
                                                   class="vi-ui label"><?php esc_html_e( 'Day(s)', 'woocommerce-orders-tracking' ) ?></label>
                                        </div>
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                        <p>
                            <input type="submit" class="vi-ui button primary" name="wot_save_cron_update_tracking"
                                   value="<?php esc_html_e( 'Save', 'woocommerce-orders-tracking' ) ?> "/>
                        </p>
                    </form>
					<?php
				} else {
					?>
                    <div class="vi-ui negative message">
                        <div class="header"><?php esc_html_e( 'Schedule update is not available with your currently selected tracking service', 'woocommerce-orders-tracking' ); ?></div>
                    </div>
					<?php
				}
				?>
            </div>
			<?php
		}

		/**
		 * @throws Exception
		 */
		public function cron_update_tracking() {
			$service_carrier_type       = $this->settings->get_params( 'service_carrier_type' );
			$service_carrier_api_key    = $this->settings->get_params( 'service_carrier_api_key' );
			$change_order_status        = $this->settings->get_params( 'change_order_status' );
			$cron_update_tracking_range = absint( $this->settings->get_params( 'cron_update_tracking_range' ) );
			if ( $cron_update_tracking_range < 1 ) {
				$cron_update_tracking_range = 1;
			}
			switch ( $service_carrier_type ) {
				case 'trackingmore':
					if ( $service_carrier_api_key ) {
						$trackingmore = new VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE( $service_carrier_api_key );
						$limit        = 200;//max 2000
						$track_data   = $trackingmore->get_multiple_trackings( array(), array(), "-{$cron_update_tracking_range} days", '', '', 1, $limit );
						if ( $track_data['status'] === 'success' ) {
							$track_info = $track_data['data'];
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::update_tracking_data( $track_info['items'], $change_order_status );
							$total    = absint( $track_info['total'] );
							$page_max = ceil( $total / $limit );
							if ( $page_max > 1 ) {
								sleep( 1 );
								for ( $page = 2; $page <= $page_max; $page ++ ) {
									$track_data = $trackingmore->get_multiple_trackings( array(), array(), "-{$cron_update_tracking_range} days", '', '', $page, $limit );
									if ( $track_data['status'] === 'success' ) {
										$track_info = $track_data['data'];
										VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::update_tracking_data( $track_info['items'], $change_order_status );
									}
									sleep( 1 );
								}
							}
						}
					}
					break;
				case 'tracktry':
					if ( $service_carrier_api_key ) {
						$tracktry = new VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKTRY( $service_carrier_api_key );
						$limit        = 200;//max 2000
						$track_data   = $tracktry->get_multiple_trackings( array(), array(), "-{$cron_update_tracking_range} days", '', '', 1, $limit );
						if ( $track_data['status'] === 'success' ) {
							$track_info = $track_data['data'];
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKTRY::update_tracking_data( $track_info['items'], $change_order_status );
							$total    = absint( $track_info['total'] );
							$page_max = ceil( $total / $limit );
							if ( $page_max > 1 ) {
								sleep( 1 );
								for ( $page = 2; $page <= $page_max; $page ++ ) {
									$track_data = $tracktry->get_multiple_trackings( array(), array(), "-{$cron_update_tracking_range} days", '', '', $page, $limit );
									if ( $track_data['status'] === 'success' ) {
										$track_info = $track_data['data'];
										VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKTRY::update_tracking_data( $track_info['items'], $change_order_status );
									}
									sleep( 1 );
								}
							}
						}
					}
					break;
				case 'aftership':
					if ( $service_carrier_api_key ) {
						$existing_carriers = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_existing_carriers( $service_carrier_type );
						if ( count( $existing_carriers ) ) {
							foreach ( $existing_carriers as $existing_carrier ) {
								$carrier_id = $existing_carrier['carrier_id'];
								$carrier    = $this->settings->get_shipping_carrier_by_slug( $carrier_id );
								if ( is_array( $carrier ) && count( $carrier ) ) {
									$carrier_name = $carrier['name'];
									$find_carrier = VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::get_carrier_slug_by_name( $carrier_name );
									$afterShip    = new VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP( $service_carrier_api_key );
									$limit        = 200;//max 200
									$track_data   = $afterShip->request_multiple_tracking_data( array( $find_carrier ), '', "-{$cron_update_tracking_range} days", '', 1, $limit );
									if ( $track_data['status'] === 'success' ) {
										$track_info = $track_data['data'];
										$count      = absint( $track_info['count'] );
										$page_max   = ceil( $count / $limit );
										VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::update_tracking_data( $track_info['trackings'], $carrier_id, $service_carrier_type, $change_order_status );
										if ( $page_max > 1 ) {
											for ( $page = 2; $page <= $page_max; $page ++ ) {
												$track_data = $afterShip->request_multiple_tracking_data( array( $find_carrier ), '', "-{$cron_update_tracking_range} days", '', $page, $limit );
												if ( $track_data['status'] === 'success' ) {
													$track_info = $track_data['data'];
													VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::update_tracking_data( $track_info['trackings'], $carrier_id, $service_carrier_type, $change_order_status );
												}
											}
										}
									}
								}
							}
						}
					}
					break;
				case '17track':
					if ( $service_carrier_api_key ) {
						$_17track           = new VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK( $service_carrier_api_key );
						$register_time_from = date( 'Y-m-d', strtotime( "-{$cron_update_tracking_range} days" ) );
						$track_list         = $_17track->get_track_list( $register_time_from );

						if ( $track_list['status'] === 'success' ) {
							if ( count( $track_list['data'] ) ) {
								self::handle_17track_data( $track_list, $_17track, $change_order_status );
								if ( $track_list['page']['page_total'] > 1 ) {
									for ( $i = 2; $i <= $track_list['page']['page_total']; $i ++ ) {
										$track_list = $_17track->get_track_list( $register_time_from );
										if ( $track_list['status'] === 'success' ) {
											if ( count( $track_list['data'] ) ) {
												self::handle_17track_data( $track_list, $_17track, $change_order_status );
											}
										}
									}
								}
							}
						}
					}
					break;
				case 'easypost':
					if ( $service_carrier_api_key ) {
						$existing_carriers = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_existing_carriers( $service_carrier_type );
						if ( count( $existing_carriers ) ) {
							foreach ( $existing_carriers as $existing_carrier ) {
								$carrier_id = $existing_carrier['carrier_id'];
								$carrier    = $this->settings->get_shipping_carrier_by_slug( $carrier_id );
								if ( is_array( $carrier ) && count( $carrier ) ) {
									$carrier_name = $carrier['name'];
									$find_carrier = VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::get_carrier_slug_by_name( $carrier_name );
									$easyPost     = new VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST( $service_carrier_api_key );
									$page_size    = 100;//max 100
									$has_more     = true;
									$before_id    = '';
									while ( $has_more ) {
										$track_data = $easyPost->retrieve_multiple( $find_carrier, '', '', $before_id, "-{$cron_update_tracking_range} days", '', $page_size );
										if ( $track_data['status'] === 'success' ) {
											$track_info = $track_data['data'];
											$has_more   = $track_data['has_more'];
											if ( $track_info_count = count( $track_info ) > 0 ) {
												VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::update_tracking_data( $track_info, $carrier_id, $service_carrier_type, $change_order_status );
												$before_id = $track_info[ $track_info_count - 1 ]['id'];
											}
										} else {
											$has_more = false;
										}
									}
								}
							}
						}
					}
					break;
				default:
					$this->unschedule_event();
					$args                         = $this->settings->get_params();
					$args['cron_update_tracking'] = '';
					update_option( 'woo_orders_tracking_settings', $args );
			}
		}

		/**
		 * @param $track_list
		 * @param $_17track VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK
		 * @param $change_order_status
		 *
		 * @throws Exception
		 */
		private static function handle_17track_data( $track_list, $_17track, $change_order_status ) {
			$trackings = array();
			foreach ( $track_list['data'] as $key => $value ) {
				if ( ! empty( $value['number'] ) ) {
					$trackings[] = array(
						'tracking_number' => $value['number'],
						'carrier'         => $value['carrier'],
					);
				}
			}
			$bulk_track_data = $_17track->request_tracking_data( $trackings );
			if ( $bulk_track_data['status'] === 'success' ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK::update_tracking_data( $bulk_track_data['data'], $change_order_status );
			}
		}

		public function save_options() {
			global $woo_orders_tracking_settings;
			if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'schedule_update' ) ) ) {
				return;
			}
			if ( ! isset( $_POST['wot_save_cron_update_tracking'] ) || ! $_POST['wot_save_cron_update_tracking'] ) {
				return;
			}
			if ( ! isset( $_POST['wot_cron_update_tracking_nonce'] ) || ! wp_verify_nonce( $_POST['wot_cron_update_tracking_nonce'], 'wot_cron_update_tracking' ) ) {
				return;
			}
			$woo_orders_tracking_settings['cron_update_tracking']          = isset( $_POST['woo_orders_tracking_cron_update_tracking'] ) ? sanitize_text_field( $_POST['woo_orders_tracking_cron_update_tracking'] ) : '';
			$woo_orders_tracking_settings['cron_update_tracking_interval'] = isset( $_POST['woo_orders_tracking_cron_update_tracking_interval'] ) ? absint( sanitize_text_field( $_POST['woo_orders_tracking_cron_update_tracking_interval'] ) ) : 1;
			$woo_orders_tracking_settings['cron_update_tracking_hour']     = isset( $_POST['woo_orders_tracking_cron_update_tracking_hour'] ) ? absint( sanitize_text_field( $_POST['woo_orders_tracking_cron_update_tracking_hour'] ) ) : 0;
			$woo_orders_tracking_settings['cron_update_tracking_minute']   = isset( $_POST['woo_orders_tracking_cron_update_tracking_minute'] ) ? absint( sanitize_text_field( $_POST['woo_orders_tracking_cron_update_tracking_minute'] ) ) : 0;
			$woo_orders_tracking_settings['cron_update_tracking_second']   = isset( $_POST['woo_orders_tracking_cron_update_tracking_second'] ) ? absint( sanitize_text_field( $_POST['woo_orders_tracking_cron_update_tracking_second'] ) ) : 0;
			$woo_orders_tracking_settings['cron_update_tracking_range']    = isset( $_POST['woo_orders_tracking_cron_update_tracking_range'] ) ? absint( sanitize_text_field( $_POST['woo_orders_tracking_cron_update_tracking_range'] ) ) : 0;
			if ( $woo_orders_tracking_settings['cron_update_tracking'] && ( ! $this->settings->get_params( 'cron_update_tracking' ) || $woo_orders_tracking_settings['cron_update_tracking_interval'] != $this->settings->get_params( 'cron_update_tracking_interval' ) || $woo_orders_tracking_settings['cron_update_tracking_hour'] != $this->settings->get_params( 'cron_update_tracking_hour' ) || $woo_orders_tracking_settings['cron_update_tracking_minute'] != $this->settings->get_params( 'cron_update_tracking_minute' ) || $woo_orders_tracking_settings['cron_update_tracking_second'] != $this->settings->get_params( 'cron_update_tracking_second' ) ) ) {
				update_option( 'woo_orders_tracking_settings', $woo_orders_tracking_settings );
				$gmt_offset = intval( get_option( 'gmt_offset' ) );
				$this->unschedule_event();
				$schedule_time_local = strtotime( 'today' ) + HOUR_IN_SECONDS * abs( $woo_orders_tracking_settings['cron_update_tracking_hour'] ) + MINUTE_IN_SECONDS * abs( $woo_orders_tracking_settings['cron_update_tracking_minute'] ) + $woo_orders_tracking_settings['cron_update_tracking_second'];
				if ( $gmt_offset < 0 ) {
					$schedule_time_local -= DAY_IN_SECONDS;
				}
				$schedule_time = $schedule_time_local - HOUR_IN_SECONDS * $gmt_offset;
				if ( $schedule_time < time() ) {
					$schedule_time += DAY_IN_SECONDS;
				}
				/*Call here to apply new interval to cron_schedules filter when calling method wp_schedule_event*/
				$this->settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance( true );
				$schedule       = wp_schedule_event( $schedule_time, 'woo_orders_tracking_cron_update_tracking_interval', 'woo_orders_tracking_cron_update_tracking' );

				if ( $schedule !== false ) {
					$this->next_schedule = $schedule_time;
				} else {
					$this->next_schedule = '';
				}
			} else {
				update_option( 'woo_orders_tracking_settings', $woo_orders_tracking_settings );
				$this->settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance( true );
				if ( ! $woo_orders_tracking_settings['cron_update_tracking'] ) {
					$this->unschedule_event();
				}
			}
		}

		public function unschedule_event() {
			if ( $this->next_schedule ) {
				wp_unschedule_hook( 'woo_orders_tracking_cron_update_tracking' );
				$this->next_schedule = '';
			}
		}

		public function admin_enqueue_scripts() {
			global $pagenow;
			$page = isset( $_REQUEST['page'] ) ? sanitize_text_field( $_REQUEST['page'] ) : '';
			if ( $pagenow === 'admin.php' && $page === 'woocommerce-orders-tracking-cron-update-tracking' ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_SETTINGS::admin_enqueue_semantic();
			}
		}
	}
}