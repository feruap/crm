<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE {
		/**
		 * Create table
		 */
		public static function create_table() {
			global $wpdb;
			$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';

			$query = "CREATE TABLE IF NOT EXISTS {$table} (
                             `id` bigint(20) NOT NULL AUTO_INCREMENT,
                             `tracking_number` VARCHAR(50) NOT NULL,
                             `order_id` bigint(20),
                             `carrier_id` VARCHAR(50) NOT NULL,
                             `carrier_service` VARCHAR(50) NOT NULL,
                             `status` VARCHAR(50),
                             `track_info` LONGTEXT,
                             `last_event` LONGTEXT,
                             `create_at` DATETIME,
                             `modified_at` DATETIME,
                             `est_delivery_date` DATETIME,
                             `origin_country` VARCHAR(50),
                             `destination_country` VARCHAR(50),
                             PRIMARY KEY  (`id`)
                             )";
			$wpdb->query( $query );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		}

		/**
		 * @param $id
		 * @param string $order_id
		 * @param string $carrier_id
		 * @param string $carrier_service
		 * @param string $status
		 * @param string $track_info
		 * @param string $last_event
		 * @param string $est_delivery_date
		 * @param string $origin_country
		 * @param string $destination_country
		 * @param bool|string $modified_at
		 */
		public static function update( $id, $order_id = '', $carrier_id = '', $carrier_service = '', $status = '', $track_info = '', $last_event = '', $est_delivery_date = '', $origin_country = '', $destination_country = '', $modified_at = false ) {
			global $wpdb;
			$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			if ( $modified_at === false ) {
				$modified_at = date( 'Y-m-d H:i:s' );// phpcs:ignore WordPress.DateTime.RestrictedFunctions.date_date
			}
			$update = array(
				'modified_at' => $modified_at
			);
			if ( $order_id ) {
				$update['order_id'] = $order_id;
			}
			if ( $carrier_id ) {
				$update['carrier_id'] = $carrier_id;
			}
			if ( $carrier_service ) {
				$update['carrier_service'] = $carrier_service;
			}
			if ( $status ) {
				$update['status'] = $status;
			}
			if ( $track_info ) {
				$update['track_info'] = $track_info;
			}
			if ( $last_event ) {
				$update['last_event'] = $last_event;
			}
			if ( $est_delivery_date ) {
				$update['est_delivery_date'] = $est_delivery_date;
			}
			if ( $origin_country ) {
				$update['origin_country'] = $origin_country;
			}
			if ( $destination_country ) {
				$update['destination_country'] = $destination_country;
			}
			$wpdb->update( $table,// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$update,
				array(
					'id' => $id,
				)
			);
		}

		/**Update tracking table by $tracking_number, $carrier_id and $carrier_service
		 *
		 * @param $tracking_number
		 * @param string $carrier_id
		 * @param string $carrier_service
		 * @param bool $status
		 * @param bool $track_info
		 * @param bool $last_event
		 * @param bool $est_delivery_date
		 * @param bool $origin_country
		 * @param bool $destination_country
		 *
		 * @return bool|false|int
		 */
		public static function update_by_tracking_number( $tracking_number, $carrier_id = '', $carrier_service = '', $status = false, $track_info = false, $last_event = false, $est_delivery_date = false, $origin_country = false, $destination_country = false ) {
			global $wpdb;
			$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			$query = "UPDATE {$table} SET";
			$args  = array();
			$run   = false;
			if ( $status !== false ) {
				$run    = true;
				$query  .= " status = %s,";
				$args[] = $status;
			}
			if ( $track_info !== false ) {
				$run    = true;
				$query  .= " track_info = %s,";
				$args[] = $track_info;
			}
			if ( $last_event !== false ) {
				$run    = true;
				$query  .= " last_event = %s,";
				$args[] = $last_event;
			}
			if ( $est_delivery_date !== false ) {
				$run    = true;
				$query  .= " est_delivery_date = %s,";
				$args[] = $est_delivery_date;
			}
			if ( $origin_country !== false ) {
				$run    = true;
				$query  .= " origin_country = %s,";
				$args[] = $origin_country;
			}
			if ( $destination_country !== false ) {
				$run    = true;
				$query  .= " destination_country = %s,";
				$args[] = $destination_country;
			}
			if ( $run ) {
				$query  .= " modified_at = %s WHERE tracking_number = %s";
				$args[] = date( 'Y-m-d H:i:s' );// phpcs:ignore WordPress.DateTime.RestrictedFunctions.date_date
				$args[] = $tracking_number;
				if ( $carrier_id ) {
					$query  .= " AND carrier_id = %s";
					$args[] = $carrier_id;
				}
				if ( $carrier_service ) {
					$query  .= " AND carrier_service = %s";
					$args[] = $carrier_service;
				}

				return $wpdb->query( $wpdb->prepare( $query, $args ) );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
			} else {
				return false;
			}
		}

		/**Insert data to table
		 *
		 * @param $tracking_number
		 * @param $order_id
		 * @param $carrier_id
		 * @param $carrier_service
		 * @param string $status
		 * @param string $track_info
		 * @param string $last_event
		 * @param string $est_delivery_date
		 * @param bool $modified_at
		 * @param string $origin_country
		 * @param string $destination_country
		 *
		 * @return int|bool
		 */
		public static function insert( $tracking_number, $order_id, $carrier_id, $carrier_service, $status = '', $track_info = '', $last_event = '', $est_delivery_date = '', $modified_at = false, $origin_country = '', $destination_country = '' ) {
			global $wpdb;
			$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			$now   = date( 'Y-m-d H:i:s' );// phpcs:ignore WordPress.DateTime.RestrictedFunctions.date_date
			if ( $modified_at === false ) {
				$modified_at = $now;
			}

			$wpdb->insert( $table,// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				array(
					'tracking_number'     => $tracking_number,
					'order_id'            => $order_id,
					'carrier_id'          => $carrier_id,
					'carrier_service'     => $carrier_service,
					'status'              => $status,
					'track_info'          => $track_info,
					'last_event'          => $last_event,
					'create_at'           => $now,
					'modified_at'         => $modified_at,
					'est_delivery_date'   => $est_delivery_date,
					'origin_country'      => $origin_country,
					'destination_country' => $destination_country,
				),
				array(
					'%s',
					'%d',
					'%s',
					'%s',
					'%s',
					'%s',
					'%s',
					'%s',
					'%s',
					'%s',
					'%s',
					'%s',
				)
			);
			$return = $wpdb->insert_id;

			return $return;
		}

		/**Delete row
		 *
		 * @param $id
		 *
		 * @return false|int
		 */
		public static function delete( $id ) {
			global $wpdb;
			$table  = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			$delete = $wpdb->delete( $table,// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				array(
					'id' => $id,
				),
				array(
					'%d',
				)
			);

			return $delete;
		}

		/**Get row
		 *
		 * @param $id
		 *
		 * @return array|null|object
		 */
		public static function get_row( $id ) {
			global $wpdb;
			$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			$query = "SELECT * FROM {$table} WHERE id=%d";

			return $wpdb->get_row( $wpdb->prepare( $query, $id ), ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		}

		/**Get tracking number from database
		 *
		 * @param $tracking_number
		 * @param string $carrier_id
		 * @param string $carrier_service
		 * @param string $order_id
		 * @param string $email
		 *
		 * @return array|object|null
		 */
		public static function get_row_by_tracking_number( $tracking_number, $carrier_id = '', $carrier_service = '', $order_id = '', $email = '' ) {
			global $wpdb;
			$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			$args  = array( $tracking_number );
			if ( $email ) {
				if ((get_option( 'woocommerce_feature_custom_order_tables_enabled' ) === 'yes' || get_option( 'woocommerce_custom_orders_table_enabled' ) === 'yes' ) && get_option( 'woocommerce_custom_orders_table_data_sync_enabled','no' ) === 'no'){
					$query = "SELECT * FROM {$table} as woo_orders_tracking_track_info JOIN {$wpdb->prefix}wc_orders as woo_orders_tracking_wp_postmeta ON woo_orders_tracking_track_info.order_id=woo_orders_tracking_wp_postmeta.post_id WHERE tracking_number=%s AND woo_orders_tracking_wp_postmeta.billing_email=%s";
				}else {
					$query = "SELECT * FROM {$table} as woo_orders_tracking_track_info JOIN {$wpdb->prefix}postmeta as woo_orders_tracking_wp_postmeta ON woo_orders_tracking_track_info.order_id=woo_orders_tracking_wp_postmeta.post_id WHERE tracking_number=%s AND woo_orders_tracking_wp_postmeta.meta_key='_billing_email' AND woo_orders_tracking_wp_postmeta.meta_value=%s";
				}
				$args[] = $email;
			} else {
				$query = "SELECT * FROM {$table} WHERE tracking_number=%s";
			}
			if ( $carrier_service ) {
				$query  .= " AND carrier_service=%s";
				$args[] = $carrier_service;
			}
			if ( $order_id ) {
				if ( is_array( $order_id ) ) {
					$query .= " AND order_id IN (" . implode( ', ', array_fill( 0, count( $order_id ), '%s' ) ) . ")";
					foreach ( $order_id as $v ) {
						$args[] = $v;
					}
				} else {
					$query  .= " AND order_id=%s";
					$args[] = $order_id;
				}
			}
			if ( $carrier_id ) {
				$query   .= " AND carrier_id=%s";
				$args[]  = $carrier_id;
				$results = $wpdb->get_results( $wpdb->prepare( $query, $args ), ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
				if ( count( $results ) ) {
					return $results[0];
				} else {
					return $results;
				}
			} else {
				$results = $wpdb->get_results( $wpdb->prepare( $query, $args ), ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
				if ( count( $results ) === 1 ) {
					return $results[0];
				} else {
					return $results;
				}
			}
		}

		public static function get_rows_by_tracking_number_carrier_pairs( $pairs, $service_carrier_type = '', $count = false ) {
			$results = array();
			if ( count( $pairs ) ) {
				global $wpdb;
				$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
				$where = array();
				$args  = array();
				if ( $count ) {
					$query = "SELECT count(*) FROM {$table}";
				} else {
					$query = "SELECT * FROM {$table}";
				}
				foreach ( $pairs as $pair ) {
					$where[] = 'tracking_number=%s AND carrier_id=%s';
					$args[]  = $pair['tracking_number'];
					$args[]  = $pair['carrier_slug'];
				}
				$query .= ' WHERE ' . implode( ' OR ', $where );
				if ( $service_carrier_type ) {
					$query  .= ' AND carrier_service=%s';
					$args[] = $service_carrier_type;
				}
				if ( $count ) {
					$results = $wpdb->get_var( $wpdb->prepare( $query, $args ) );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
				} else {
					$results = $wpdb->get_results( $wpdb->prepare( $query, $args ), ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
				}
			}

			return $results;
		}

		/**Get rows
		 *
		 * @param int $limit
		 * @param int $offset
		 * @param bool $count
		 *
		 * @return array|null|object|string
		 */
		public static function get_rows( $limit = 0, $offset = 0, $count = false ) {
			global $wpdb;
			$table  = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			$select = '*';
			if ( $count ) {
				$select = 'count(*)';
				$query  = "SELECT {$select} FROM {$table}";

				return $wpdb->get_var( $query );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
			} else {
				$query = "SELECT {$select} FROM {$table}";
				if ( $limit ) {
					$query .= " LIMIT {$offset},{$limit}";
				}

				return $wpdb->get_results( $query, ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
			}
		}

		public static function get_rows_by( $tracking_number = '', $carrier_id = '', $carrier_service = '', $order_id = '', $email = '', $status = array(), $exc_status = array() ) {
			global $wpdb;
			$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			$where = array();
			$args  = array();
			if ( $tracking_number ) {
				$where[] = 'tracking_number=%s';
				$args[]  = $tracking_number;
			}
			if ( $email ) {
				if ((get_option( 'woocommerce_feature_custom_order_tables_enabled' ) === 'yes' || get_option( 'woocommerce_custom_orders_table_enabled' ) === 'yes' ) && get_option( 'woocommerce_custom_orders_table_data_sync_enabled','no' ) === 'no'){
					$query = "SELECT * FROM {$table} as woo_orders_tracking_track_info JOIN {$wpdb->prefix}wc_orders as woo_orders_tracking_wp_postmeta ON woo_orders_tracking_track_info.order_id=woo_orders_tracking_wp_postmeta.id";
					$where[]      = "woo_orders_tracking_wp_postmeta.billing_email = %s";
				}else {
					$query   = "SELECT * FROM {$table} as woo_orders_tracking_track_info JOIN {$wpdb->prefix}postmeta as woo_orders_tracking_wp_postmeta ON woo_orders_tracking_track_info.order_id=woo_orders_tracking_wp_postmeta.post_id";
					$where[] = "woo_orders_tracking_wp_postmeta.meta_key='_billing_email'";
					$where[] = 'woo_orders_tracking_wp_postmeta.meta_value=%s';
				}
				$args[]  = $email;
			} else {
				$query = "SELECT * FROM {$table}";
			}
			if ( $carrier_service ) {
				$where[] = "carrier_service=%s";
				$args[]  = $carrier_service;
			}
			if ( $order_id ) {
				if ( is_array( $order_id ) ) {
					$where[] = "order_id IN (" . implode( ', ', array_fill( 0, count( $order_id ), '%s' ) ) . ")";
					foreach ( $order_id as $v ) {
						$args[] = $v;
					}
				} else {
					$where[] = "order_id=%s";
					$args[]  = $order_id;
				}
			}
			if ( $carrier_id ) {
				$where[] = "carrier_id=%s";
				$args[]  = $carrier_id;
			}
			$status_count = count( $status );
			if ( $status_count === 1 ) {
				$where[] = "status=%s";
				$args[]  = $status[0];
			} elseif ( $status_count > 1 ) {
				$where[] = "status IN (" . implode( ', ', array_fill( 0, count( $status ), '%s' ) ) . ")";
				foreach ( $status as $st ) {
					$args[] = $st;
				}
			} else {
				$exc_status_count = count( $exc_status );
				if ( $exc_status_count === 1 ) {
					$where[] = "status!=%s";
					$args[]  = $exc_status[0];
				} elseif ( $exc_status_count > 1 ) {
					$where[] = "status NOT IN (" . implode( ', ', array_fill( 0, count( $exc_status ), '%s' ) ) . ")";
					foreach ( $exc_status as $st ) {
						$args[] = $st;
					}
				}
			}
			if ( count( $where ) ) {
				$query .= ' WHERE ' . implode( ' AND ', $where );
			}
			$results = $wpdb->get_results( $wpdb->prepare( $query, $args ), ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared

			return $results;
		}

		public static function get_existing_carriers( $carrier_service = '' ) {
			global $wpdb;
			$table = $wpdb->prefix . 'vi_woo_orders_tracking_track_info';
			$query = "SELECT DISTINCT `carrier_id` from {$table}";
			if ( $carrier_service ) {
				$query .= ' WHERE carrier_service=%s';

				return $wpdb->get_results( $wpdb->prepare( $query, $carrier_service ), ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
			} else {
				return $wpdb->get_results( $query, ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
			}
		}

		/**
		 * @return array
		 */
		public static function get_cols() {
			return array(
				'id'                  => '',
				'tracking_number'     => '',
				'order_id'            => '',
				'carrier_id'          => '',
				'carrier_service'     => '',
				'status'              => '',
				'track_info'          => '',
				'last_event'          => '',
				'create_at'           => '',
				'modified_at'         => '',
				'est_delivery_date'   => '',
				'origin_country'      => '',
				'destination_country' => '',
			);
		}
	}
}