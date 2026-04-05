<?php

/**
 * Class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_LOG
 *
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_LOG {
	public function __construct() {
		add_action( 'wp_ajax_vi_wot_view_log', array( $this, 'generate_log_ajax' ) );
		add_action( 'admin_menu', array( $this, 'admin_menu' ), 39 );
		add_action( 'admin_init', array( $this, 'admin_init' ) );
		add_action( 'admin_init', array( $this, 'download_log_file' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'wc_logs_enqueue_scripts' ) );
	}

	public static function wc_log( $content, $source = 'debug', $level = 'info' ) {
		$content =  !in_array($source ,['shipstation-debug','dianxiaomi_debug', 'check']) ? strip_tags( $content ) : $content;
		$log     = wc_get_logger();
		$log->log( $level,
			$content,
			array(
				'source' => 'woo-orders-tracking-' . $source,
			)
		);
	}

	/**
	 * Use js to remove woo-orders-tracking - log files from WC/Status/Logs page because no PHP filters available
	 */
	public function wc_logs_enqueue_scripts() {
		global $pagenow;
		$page = isset( $_GET['page'] ) ? sanitize_text_field( $_GET['page'] ) : '';
		$tab  = isset( $_GET['tab'] ) ? sanitize_text_field( $_GET['tab'] ) : '';
		if ( $pagenow === 'admin.php' && $page === 'wc-status' && $tab === 'logs' ) {
			wp_enqueue_script( 'woocommerce-orders-tracking-wc-logs', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'wc-logs.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION , false);
		}
	}

	/**
	 * Download a log file to the user's computer
	 */
	public function download_log_file() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'access_logs' ) ) ) {
			return;
		}
		$nonce = isset( $_POST['_wpnonce'] ) ? sanitize_text_field( $_POST['_wpnonce'] ) : '';
		if ( $nonce && wp_verify_nonce( $nonce, 'vi_wot_download_log' ) ) {
			$file = '';
			if ( isset( $_POST['vi_wot_download_log'] ) ) {
				$log_file = sanitize_text_field( $_POST['vi_wot_download_log'] );
				if ( in_array( $log_file, $this->log_files() ) ) {
					$file = VI_WOOCOMMERCE_ORDERS_TRACKING_CACHE . $log_file . '.txt';
				}
			} else {
				$logs = WC_Log_Handler_File::get_log_files();
				if ( ! empty( $_REQUEST['log_file'] ) && isset( $logs[ sanitize_title( wp_unslash( $_REQUEST['log_file'] ) ) ] ) ) { // WPCS: input var ok, CSRF ok.
					$log_file = $logs[ sanitize_title( wp_unslash( $_REQUEST['log_file'] ) ) ]; // WPCS: input var ok, CSRF ok.
					$file     = WC_LOG_DIR . $log_file;
				}
			}
			if ( is_file( $file ) ) {
				$fh = @fopen( 'php://output', 'w' );
				fprintf( $fh, chr( 0xEF ) . chr( 0xBB ) . chr( 0xBF ) );
				header( 'Cache-Control: must-revalidate, post-check=0, pre-check=0' );
				header( 'Content-Description: File Transfer' );
				header( 'Content-type: text/csv' );
				header( 'Content-Disposition: attachment; filename=' . $log_file . '__' . date( 'Y-m-d_H-i-s' ) . '.txt' );
				header( 'Expires: 0' );
				header( 'Pragma: public' );
				fputs( $fh, file_get_contents( $file ) );
				fclose( $fh );
				die();
			}
		}
	}

	public function admin_init() {
		global $pagenow;
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'access_logs' ) ) ) {
			return;
		}
		$page   = isset( $_GET['page'] ) ? sanitize_text_field( $_GET['page'] ) : '';
		$action = isset( $_GET['action'] ) ? sanitize_text_field( $_GET['action'] ) : '';
		if ( $pagenow === 'admin.php' && $page === 'woocommerce-orders-tracking-logs' ) {
			add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
			if ( $action === 'vi_wot_delete_log' ) {
				$nonce    = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( $_GET['_wpnonce'] ) : '';
				$log_file = isset( $_GET['vi_wot_file'] ) ? sanitize_text_field( $_GET['vi_wot_file'] ) : '';
				if ( wp_verify_nonce( $nonce, 'vi_wot_delete_log' ) && in_array( $log_file, $this->log_files() ) ) {
					$file = VI_WOOCOMMERCE_ORDERS_TRACKING_CACHE . $log_file . '.txt';
					if ( is_file( $file ) ) {
						wp_delete_file( $file );
						wp_safe_redirect( admin_url( 'admin.php?page=woocommerce-orders-tracking-logs' ) );
						exit();
					}
				}
			}
		}
	}

	public function admin_enqueue_scripts() {
		wp_enqueue_style( 'woocommerce-orders-tracking-message', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'message.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_style( 'woocommerce-orders-tracking-logs', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'logs.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		wp_enqueue_script( 'woocommerce-orders-tracking-logs', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'logs.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
		wp_localize_script( 'woocommerce-orders-tracking-logs', 'woo_orders_tracking_logs_params', array(
			'i18n_confirm_delete'    => esc_html__( 'This cannot be undone, do you want to continue?', 'woocommerce-orders-tracking' ),
			'i18n_select_file_alert' => esc_html__( 'Please select a log file.', 'woocommerce-orders-tracking' ),
		) );
	}

	public function log_files() {
		return array( 'import_tracking', 'debug', 'webhooks_logs' );
	}

	public function admin_menu() {
		add_submenu_page( 'woocommerce-orders-tracking', esc_html__( 'Logs - WooCommerce Orders Tracking', 'woocommerce-orders-tracking' ), esc_html__( 'Logs', 'woocommerce-orders-tracking' ), VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'access_logs' ), 'woocommerce-orders-tracking-logs', array(
			$this,
			'page_callback'
		) );
	}

	public function page_callback() {
		?>
        <div class="wrap">
            <h2><?php esc_html_e( 'Your logs show here', 'woocommerce-orders-tracking' ) ?></h2>
            <form class="" action="" method="post">
				<?php
				wp_nonce_field( 'vi_wot_download_log' );
				$log_files = $this->log_files();
				$old_log   = '';
				foreach ( $log_files as $log_file ) {
					$log_file = self::build_log_file_name( $log_file );
					if ( is_file( $log_file ) ) {
						ob_start();
						?>
                        <li>
							<?php
							self::print_log_html( array( $log_file ) );
							?>
                        </li>
						<?php
						$old_log .= ob_get_clean();
					}
				}
				if ( $old_log ) {
					?>
                    <div class="vi-ui warning message">
                        <div class="header"><?php esc_html_e( 'Log file(s) from versions before 1.1.0', 'woocommerce-orders-tracking' ) ?></div>
                        <ul class="list">
							<?php
							echo wp_kses_post($old_log);
							?>
                        </ul>
                    </div>
					<?php
				}
				?>
            </form>
            <div class="vi-ui positive message">
                <div class="header"><?php esc_html_e( 'Since version 1.1.0, all log files are stored in the same log folder of WooCommerce.', 'woocommerce-orders-tracking' ) ?></div>
                <ul class="list">
                    <li><?php echo wp_kses_post( sprintf(esc_html__( 'Log folder: %s', 'woocommerce-orders-tracking' ), WC_LOG_DIR) )// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment ?></li>
                    <li><?php echo wp_kses_post( sprintf(esc_html__( 'Log files older than %s days will be automatically deleted by WooCommerce', 'woocommerce-orders-tracking' ), apply_filters( 'woocommerce_logger_days_to_retain_logs', 30 ) ))// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment ?></li>
                </ul>
            </div>
			<?php
			if ( class_exists( 'WC_Log_Handler_File' ) ) {
				$logs = WC_Log_Handler_File::get_log_files();
				if ( count( $logs ) ) {
					foreach ( $logs as $key => $value ) {
						if ( strpos( $key, 'woo-orders-tracking-' ) !== 0 ) {
							unset( $logs[ $key ] );
						}
					}
				}
				if ( ! empty( $_REQUEST['log_file'] ) && isset( $logs[ sanitize_title( wp_unslash( $_REQUEST['log_file'] ) ) ] ) ) { // WPCS: input var ok, CSRF ok.
					$viewed_log = $logs[ sanitize_title( wp_unslash( $_REQUEST['log_file'] ) ) ]; // WPCS: input var ok, CSRF ok.
				} elseif ( ! empty( $logs ) ) {
					$viewed_log = current( $logs );
				}

				if ( ! empty( $_REQUEST['handle'] ) ) { // WPCS: input var ok, CSRF ok.
					if ( empty( $_REQUEST['_wpnonce'] ) || ! wp_verify_nonce( wp_unslash( $_REQUEST['_wpnonce'] ), 'remove_log' ) ) { // WPCS: input var ok, sanitization ok.
						wp_die( esc_html__( 'Action failed. Please refresh the page and retry.', 'woocommerce-orders-tracking' ) );
					}
					if ( ! empty( $_REQUEST['handle'] ) ) {  // WPCS: input var ok.
						$log_handler = new WC_Log_Handler_File();
						$log_handler->remove( wp_unslash( $_REQUEST['handle'] ) ); // WPCS: input var ok, sanitization ok.
					}
					wp_safe_redirect( esc_url_raw( admin_url( 'admin.php?page=woocommerce-orders-tracking-logs' ) ) );
					exit();
				}
				$log_of = isset( $_REQUEST['log_of'] ) ? sanitize_text_field( $_REQUEST['log_of'] ) : '';
				if ( $logs ) {
					?>
                    <div id="log-viewer-select">
                        <div class="alignleft">
                            <h2>
								<?php
								echo esc_html( $viewed_log );
								if ( ! empty( $viewed_log ) ) { ?>
                                    <a class="page-title-action"
                                       href="<?php echo esc_url( wp_nonce_url( add_query_arg( array( 'handle' => sanitize_title( $viewed_log ) ), admin_url( 'admin.php?page=woocommerce-orders-tracking-logs' ) ), 'remove_log' ) ); ?>"
                                       class="button"><?php esc_html_e( 'Delete log', 'woocommerce-orders-tracking' ); ?></a>
									<?php
								}
								?>
                            </h2>
                        </div>
                        <div class="alignright">
                            <form class="vi-wot-logs-form"
                                  action="<?php echo esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking-logs' ) ); ?>"
                                  method="post">
                                <select name="log_of">
                                    <option value=""><?php esc_html_e( 'All log files', 'woocommerce-orders-tracking' ) ?></option>
									<?php
									foreach (
										array(
											'import-tracking' => esc_html__( 'Import tracking', 'woocommerce-orders-tracking' ),
											'webhooks'        => esc_html__( 'Webhooks', 'woocommerce-orders-tracking' ),
											'webhooks-debug'  => esc_html__( 'Webhooks debug', 'woocommerce-orders-tracking' ),
											'paypal-debug'    => esc_html__( 'PayPal debug', 'woocommerce-orders-tracking' ),
											'dianxiaomi-debug'    => esc_html__( 'Dianxiaomi debug', 'woocommerce-orders-tracking' ),
											'yakkyofy'    => esc_html__( 'Yakkyofy', 'woocommerce-orders-tracking' ),
										) as $log_id => $log_name
									) {
										?>
                                        <option value="<?php echo esc_attr( $log_id ) ?>" <?php selected( $log_of, $log_id ); ?>><?php echo esc_html( $log_name ) ?></option>
										<?php
									}
									?>
                                </select>
                                <select name="log_file">
                                    <option value=""><?php esc_html_e( 'No files found', 'woocommerce-orders-tracking' ) ?></option>
									<?php
									foreach ( $logs as $log_key => $log_file ) {
										$timestamp = filemtime( WC_LOG_DIR . $log_file );
										$date      = sprintf(
										/* translators: 1: last access date 2: last access time 3: last access timezone abbreviation */
											__( '%1$s at %2$s %3$s', 'woocommerce-orders-tracking' ),
											wp_date( wc_date_format(), $timestamp ),
											wp_date( wc_time_format(), $timestamp ),
											wp_date( 'T', $timestamp )
										);
										?>
                                        <option value="<?php echo esc_attr( $log_key ); ?>" <?php selected( sanitize_title( $viewed_log ), $log_key ); ?>><?php echo esc_html( $log_file ); ?>
                                            (<?php echo esc_html( $date ); ?>)
                                        </option>
										<?php
									}
									?>
                                </select>
                                <button type="submit" class="button"
                                        value="<?php esc_attr_e( 'View', 'woocommerce-orders-tracking' ); ?>"><?php esc_html_e( 'View', 'woocommerce-orders-tracking' ); ?></button>
                                <button type="submit" class="button" name="_wpnonce"
                                        title="<?php esc_attr_e( 'Download selected log file to your device', 'woocommerce-orders-tracking' ); ?>"
                                        value="<?php echo esc_attr( wp_create_nonce( 'vi_wot_download_log' ) ); ?>"><?php esc_html_e( 'Download', 'woocommerce-orders-tracking' ); ?></button>
                            </form>
                        </div>
                        <div class="clear"></div>
                    </div>
                    <div id="log-viewer">
                        <pre><?php echo esc_html( file_get_contents( WC_LOG_DIR . $viewed_log ) ); ?></pre>
                    </div>
					<?php
				} else {
					?>
                    <div class="updated woocommerce-message inline">
                        <p><?php esc_html_e( 'There are currently no logs to view.', 'woocommerce-orders-tracking' ); ?></p>
                    </div>
					<?php
				}
			}
			?>
        </div>
		<?php
	}

	/**
	 * View import log
	 */
	public function generate_log_ajax() {
		/*Check the nonce*/
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'access_logs' ) ) || empty( $_GET['action'] ) || ! check_admin_referer( wp_unslash( $_GET['action'] ) ) ) {
			wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'woocommerce-orders-tracking' ) );
		}
		if ( empty( $_GET['vi_wot_file'] ) ) {
			wp_die( esc_html__( 'No log file selected.', 'woocommerce-orders-tracking' ) );
		}
		$file = urldecode( wp_unslash( wc_clean( $_GET['vi_wot_file'] ) ) );
		if ( ! is_file( $file ) ) {
			wp_die( esc_html__( 'Log file not found.', 'woocommerce-orders-tracking' ) );
		}
		echo( wp_kses_post( nl2br( file_get_contents( $file ) ) ) );
		exit();
	}

	public static function print_log_html( $logs ) {
		if ( is_array( $logs ) && count( $logs ) ) {
			$page = isset( $_GET['page'] ) ? sanitize_text_field( $_GET['page'] ) : '';
			foreach ( $logs as $log ) {
				?>
                <p><?php echo esc_html( $log ) ?>
                    <a target="_blank" href="<?php echo esc_url( add_query_arg( array(
						'action'      => 'vi_wot_view_log',
						'vi_wot_file' => urlencode( $log ),
						'_wpnonce'    => wp_create_nonce( 'vi_wot_view_log' ),
					), admin_url( 'admin-ajax.php' ) ) ) ?>"><?php esc_html_e( 'View log', 'woocommerce-orders-tracking' ) ?>
                    </a>
					<?php
					if ( $page === 'woocommerce-orders-tracking-logs' ) {
						$file_name = explode( '.', substr( $log, strlen( VI_WOOCOMMERCE_ORDERS_TRACKING_CACHE ) ) )[0];
						?>
                        ,
                        <a class="vi-wot-delete-log" href="<?php echo esc_url( add_query_arg( array(
							'action'      => 'vi_wot_delete_log',
							'vi_wot_file' => $file_name,
							'_wpnonce'    => wp_create_nonce( 'vi_wot_delete_log' ),
						) ) ) ?>"><?php esc_html_e( 'Delete', 'woocommerce-orders-tracking' ) ?>
                        </a>
						<?php esc_html_e( ' or ', 'woocommerce-orders-tracking' ); ?>
                        <button type="submit" name="vi_wot_download_log" value="<?php echo esc_attr( $file_name ) ?>"
                                class="vi-wot-download-log"><?php esc_html_e( 'Download log file', 'woocommerce-orders-tracking' ) ?>
                        </button>
						<?php
					}
					?>
                </p>
				<?php
			}
		}
	}

	public static function build_log_file_name( $log_file ) {
		$ext      = '';
		$pathinfo = pathinfo( $log_file );
		if ( empty( $pathinfo['extension'] ) ) {
			$ext = '.txt';
		}

		return VI_WOOCOMMERCE_ORDERS_TRACKING_CACHE . $log_file . $ext;
	}
}