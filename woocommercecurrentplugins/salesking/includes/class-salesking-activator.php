<?php


class Salesking_Activator {

	public static function activate() {

		// prevent option update issues due to caching
		wp_cache_delete ( 'alloptions', 'options' );

		// check if first activation
		$first_activation = get_option('salesking_first_time_setup', 'yes');
		if ($first_activation === 'yes'){
			// create sales agents dashboard page with shortcode
			$post_details = array(
			'post_title'    => esc_html__('Agent Dashboard', 'salesking'),
			'post_content'  => '',
			'post_status'   => 'publish',
			'post_author'   => 1,
			'post_type' => 'page'
			 );
			$id = wp_insert_post( $post_details );
			
			update_option('salesking_first_time_setup', 'no');
			update_option('salesking_agents_page_setting', $id);

			// create agents group
			$groups = get_posts([
			  'post_type' => 'salesking_group',
			  'post_status' => 'publish',
			  'numberposts' => -1,
			  'fields' => 'ids',
			]);

			if (intval(count($groups)) === 0){
				// there are no groups, let's create a B2B group
				$groupp = array(
					'post_title'  => sanitize_text_field( esc_html__( 'Main Agents', 'salesking' ) ),
					'post_status' => 'publish',
					'post_type'   => 'salesking_group',
					'post_author' => 1,
				);
				$group_id = wp_insert_post( $groupp );
			}
		}

		// Check Product Number and User Number. Deactivate products / users selector in dynamic rules if too many
		$users = count_users();
		if (isset($users['avail_roles']['customer'])){

			if (intval($users['avail_roles']['customer']) > 1500){
				// hide users
				update_option('salesking_hide_users_commission_rules_setting', 1);
			}
		}

	}

}
