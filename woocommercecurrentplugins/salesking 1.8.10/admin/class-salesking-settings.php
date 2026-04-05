<?php

/**
*
* PHP File that handles Settings management
*
*/

class Salesking_Settings {

	public function register_all_settings() {

		
		add_settings_section('salesking_main_settings_section_dashboard', '',	'',	'salesking');
		add_settings_section('salesking_main_settings_section_modules', '',	'',	'salesking');
		add_settings_section('salesking_main_settings_section_registration', '',	'',	'salesking');
		add_settings_section('salesking_main_settings_section_agentcapabilities', '',	'',	'salesking');
		add_settings_section('salesking_main_settings_section_commission', '',	'',	'salesking');
		add_settings_section('salesking_main_settings_section_payouts', '',	'',	'salesking');
		add_settings_section('salesking_main_settings_section_tools', '',	'',	'salesking');


		// Choose Sales Agents Page
		register_setting('salesking', 'salesking_agents_page_setting');
		add_settings_field('salesking_agents_page_setting', esc_html__('Agents Dashboard Page', 'salesking'), array($this,'salesking_agents_page_setting_content'), 'salesking', 'salesking_main_settings_section_dashboard');

		// Logo Upload
		register_setting( 'salesking', 'salesking_logo_setting');
		add_settings_field('salesking_logo_setting', esc_html__('Agents Dashboard Logo','salesking'), array($this,'salesking_logo_setting_content'), 'salesking', 'salesking_main_settings_section_dashboard');

		// Favicon Upload
		register_setting( 'salesking', 'salesking_logo_favicon_setting');
		add_settings_field('salesking_logo_favicon_setting', esc_html__('Agents Dashboard Favicon','salesking'), array($this,'salesking_logo_favicon_setting_content'), 'salesking', 'salesking_main_settings_section_dashboard');

		// Change Color
		register_setting( 'salesking', 'salesking_change_color_scheme_setting');
		add_settings_field('salesking_change_color_scheme_setting', esc_html__('Change Color Scheme (beta)','salesking'), array($this,'salesking_change_color_scheme_setting_content'), 'salesking', 'salesking_main_settings_section_dashboard');

		// Main Color
		register_setting(
			'salesking',
			'salesking_main_dashboard_color_setting',
			array(
				'sanitize_callback' => function ( $input ) {
					return $input === null ? get_option( 'salesking_main_dashboard_color_setting', '#854fff' ) : $input;
				},
			)
		);
		add_settings_field( 'salesking_main_dashboard_color_setting', esc_html__( 'Dashboard Color', 'salesking' ), array( $this, 'salesking_main_dashboard_color_setting_content' ), 'salesking', 'salesking_vendordash_color_fields_settings_section' );

		// Main Color Hover
		register_setting(
			'salesking',
			'salesking_main_dashboard_hover_color_setting',
			array(
				'sanitize_callback' => function ( $input ) {
					return $input === null ? get_option( 'salesking_main_dashboard_hover_color_setting', '#6a29ff' ) : $input;
				},
			)
		);
		add_settings_field( 'salesking_main_dashboard_hover_color_setting', esc_html__( 'Dashboard Color Hover', 'salesking' ), array( $this, 'salesking_main_dashboard_hover_color_setting_content' ), 'salesking', 'salesking_vendordash_color_fields_settings_section' );


		// Current Tab Setting - Misc setting, hidden, only saves the last opened menu tab
		register_setting( 'salesking', 'salesking_current_tab_setting');
		add_settings_field('salesking_current_tab_setting', '', array($this, 'salesking_current_tab_setting_content'), 'salesking', 'salesking_hiddensettings');


		add_settings_section('salesking_language_settings_section', '',	'',	'salesking');

		// Purchase Lists Language
		register_setting('salesking', 'salesking_tables_language_option_setting');
		add_settings_field('salesking_tables_language_option_setting', esc_html__('Choose Tables Language', 'salesking'), array($this,'salesking_tables_language_option_setting_content'), 'salesking', 'salesking_language_settings_section');


		/* License Settings */
		add_settings_section('salesking_license_settings_section', '',	'',	'salesking');

		// only show details if license is not active
		$license = get_option('salesking_license_key_setting', '');
		$email = get_option('salesking_license_email_setting', '');
		$info = parse_url(get_site_url());
		$host = $info['host'];
		$host_names = explode(".", $host);

		if (isset($host_names[count($host_names)-2])){ // e.g. if not on localhost, xampp etc
		    $bottom_host_name = $host_names[count($host_names)-2] . "." . $host_names[count($host_names)-1];

		    if (strlen($host_names[count($host_names)-2]) <= 3){    // likely .com.au, .co.uk, .org.uk etc
		        if (isset($host_names[count($host_names)-3])){
		            $bottom_host_name_new = $host_names[count($host_names)-3] . "." . $host_names[count($host_names)-2] . "." . $host_names[count($host_names)-1];
		            $bottom_host_name = $bottom_host_name_new;
		        }
		    }

		    $activation = get_option('pluginactivation_'.$email.'_'.$license.'_'.$bottom_host_name);

		    if ($activation !== 'active'){

				register_setting('salesking', 'salesking_license_email_setting');
				add_settings_field('salesking_license_email_setting', esc_html__('License email', 'salesking'), array($this,'salesking_license_email_setting_content'), 'salesking', 'salesking_license_settings_section');

				register_setting('salesking', 'salesking_license_key_setting');
				add_settings_field('salesking_license_key_setting', esc_html__('License key', 'salesking'), array($this,'salesking_license_key_setting_content'), 'salesking', 'salesking_license_settings_section');

			}
		}


		// Enable announcements
		register_setting('salesking', 'salesking_enable_announcements_setting');
		add_settings_field('salesking_enable_announcements_setting', esc_html__('Enable Announcements', 'salesking'), array($this,'salesking_enable_announcements_setting_content'), 'salesking', 'salesking_main_settings_section_modules');

		// Enable messages
		register_setting('salesking', 'salesking_enable_messages_setting');
		add_settings_field('salesking_enable_messages_setting', esc_html__('Enable Messages', 'salesking'), array($this,'salesking_enable_messages_setting_content'), 'salesking', 'salesking_main_settings_section_modules');

		// Enable coupons
		register_setting('salesking', 'salesking_enable_coupons_setting');
		add_settings_field('salesking_enable_coupons_setting', esc_html__('Enable Coupons', 'salesking'), array($this,'salesking_enable_coupons_setting_content'), 'salesking', 'salesking_main_settings_section_modules');

		if (defined('B2BKING_DIR')){
			register_setting('salesking', 'salesking_enable_offers_setting');
			add_settings_field('salesking_enable_offers_setting', esc_html__('Enable Offers', 'salesking'), array($this,'salesking_enable_offers_setting_content'), 'salesking', 'salesking_main_settings_section_modules');
		}

		// Enable affiliate links
		register_setting('salesking', 'salesking_enable_affiliate_links_setting');
		add_settings_field('salesking_enable_affiliate_links_setting', esc_html__('Enable Affiliate Links', 'salesking'), array($this,'salesking_enable_affiliate_links_setting_content'), 'salesking', 'salesking_main_settings_section_modules');

		// Enable cart sharing
		register_setting('salesking', 'salesking_enable_cart_sharing_setting');
		add_settings_field('salesking_enable_cart_sharing_setting', esc_html__('Enable Cart Sharing', 'salesking'), array($this,'salesking_enable_cart_sharing_setting_content'), 'salesking', 'salesking_main_settings_section_modules');

		// Enable teams
		register_setting('salesking', 'salesking_enable_teams_setting');
		add_settings_field('salesking_enable_teams_setting', esc_html__('Enable Teams', 'salesking'), array($this,'salesking_enable_teams_setting_content'), 'salesking', 'salesking_main_settings_section_modules');

		// Enable earnings
		register_setting('salesking', 'salesking_enable_earnings_setting');
		add_settings_field('salesking_enable_earnings_setting', esc_html__('Enable Earnings', 'salesking'), array($this,'salesking_enable_earnings_setting_content'), 'salesking', 'salesking_main_settings_section_modules');

		// Enable payouts
		register_setting('salesking', 'salesking_enable_payouts_setting');
		add_settings_field('salesking_enable_payouts_setting', esc_html__('Enable Payouts', 'salesking'), array($this,'salesking_enable_payouts_setting_content'), 'salesking', 'salesking_main_settings_section_modules');


		// Enable Agent ID at registration
		register_setting('salesking', 'salesking_enable_agent_id_registration_setting');
		add_settings_field('salesking_enable_agent_id_registration_setting', esc_html__('Add Sales Agent ID to WooCommerce Registration', 'salesking'), array($this,'salesking_enable_agent_id_registration_setting_content'), 'salesking', 'salesking_main_settings_section_registration');

		// Enable Agent Dropdown at registration
		register_setting('salesking', 'salesking_enable_agent_id_registration_dropdown_setting');
		add_settings_field('salesking_enable_agent_id_registration_dropdown_setting', esc_html__('Add Sales Agent Dropdown to WooCommerce Registration', 'salesking'), array($this,'salesking_enable_agent_id_registration_dropdown_setting_content'), 'salesking', 'salesking_main_settings_section_registration');

		// Automatically assign user to agent at registration 
		register_setting('salesking', 'salesking_enable_random_assign_agent_setting');
		add_settings_field('salesking_enable_random_assign_agent_setting', esc_html__('Assign Agent Automatically at Registration', 'salesking'), array($this,'salesking_enable_random_assign_agent_setting_content'), 'salesking', 'salesking_main_settings_section_registration');

		// Agents can edit customers' profiles
		register_setting('salesking', 'salesking_agents_can_edit_customers_setting');
		add_settings_field('salesking_agents_can_edit_customers_setting', esc_html__('Allow agents to edit customer profiles', 'salesking'), array($this,'salesking_agents_can_edit_customers_setting_content'), 'salesking', 'salesking_main_settings_section_agentcapabilities');

		// Agents can manage their customers' orders
		register_setting('salesking', 'salesking_agents_can_manage_orders_setting');
		add_settings_field('salesking_agents_can_manage_orders_setting', esc_html__('Allow agents to manage their assigned orders', 'salesking'), array($this,'salesking_agents_can_manage_orders_setting_content'), 'salesking', 'salesking_main_settings_section_agentcapabilities');

		// Agents receive emails notifying them of new orders assigned to them
		register_setting('salesking', 'salesking_agents_receive_order_emails_setting');
		add_settings_field('salesking_agents_receive_order_emails_setting', esc_html__('Agents receive new order emails', 'salesking'), array($this,'salesking_agents_receive_order_emails_setting_content'), 'salesking', 'salesking_main_settings_section_agentcapabilities');

		// PayPal Payouts
		register_setting('salesking', 'salesking_enable_paypal_payouts_setting');
		add_settings_field('salesking_enable_paypal_payouts_setting', esc_html__('Enable PayPal for payouts', 'salesking'), array($this,'salesking_enable_paypal_payouts_setting_content'), 'salesking', 'salesking_main_settings_section_payouts');

		// Bank Payouts
		register_setting('salesking', 'salesking_enable_bank_payouts_setting');
		add_settings_field('salesking_enable_bank_payouts_setting', esc_html__('Enable Bank Payments for payouts', 'salesking'), array($this,'salesking_enable_bank_payouts_setting_content'), 'salesking', 'salesking_main_settings_section_payouts');

		// Configure Custom Payout Method
		register_setting('salesking', 'salesking_enable_custom_payouts_setting');
		add_settings_field('salesking_enable_custom_payouts_setting', esc_html__('Configure Custom Method for payouts', 'salesking'), array($this,'salesking_enable_custom_payouts_setting_content'), 'salesking', 'salesking_main_settings_section_payouts');


		// Agents can edit prices to offer discounts
		register_setting('salesking', 'salesking_agents_can_edit_prices_discounts_setting');
		add_settings_field('salesking_agents_can_edit_prices_discounts_setting', esc_html__('Agents can edit prices to offer discounts', 'salesking'), array($this,'salesking_agents_can_edit_prices_discounts_setting_content'), 'salesking', 'salesking_main_settings_section_agentcapabilities');

		// Agents can edit prices to increase price
		register_setting('salesking', 'salesking_agents_can_edit_prices_increase_setting');
		add_settings_field('salesking_agents_can_edit_prices_increase_setting', esc_html__('Agents can edit prices to increase price', 'salesking'), array($this,'salesking_agents_can_edit_prices_increase_setting_content'), 'salesking', 'salesking_main_settings_section_agentcapabilities');

		// All agents shop for all customers
		register_setting('salesking', 'salesking_all_agents_shop_all_customers_setting');
		add_settings_field('salesking_all_agents_shop_all_customers_setting', esc_html__('All agents can manage / shop for all customers', 'salesking'), array($this,'salesking_all_agents_shop_all_customers_setting_content'), 'salesking', 'salesking_main_settings_section_agentcapabilities');

		// Set teams levels
		register_setting('salesking', 'salesking_enable_teams_levels_setting');
		add_settings_field('salesking_enable_teams_levels_setting', esc_html__('Maximum subagent levels', 'salesking'), array($this,'salesking_enable_teams_levels_setting_content'), 'salesking', 'salesking_main_settings_section_agentcapabilities');

		// Commissions are calculated based on pre-tax amount
		register_setting('salesking', 'salesking_commissions_calculated_including_tax_setting');
		add_settings_field('salesking_commissions_calculated_including_tax_setting', esc_html__('Commission calculation includes tax', 'salesking'), array($this,'salesking_commissions_calculated_including_tax_setting_content'), 'salesking', 'salesking_main_settings_section_commission');

		// Substract parent agent commission from agent commission
		register_setting('salesking', 'salesking_substract_subagent_earnings_agent_setting');
		add_settings_field('salesking_substract_subagent_earnings_agent_setting', esc_html__('Substract parent agent commissions', 'salesking'), array($this,'salesking_substract_subagent_earnings_agent_setting_content'), 'salesking', 'salesking_main_settings_section_commission');

		// Give agents commission for their own orders
		register_setting('salesking', 'salesking_agents_own_orders_commission_setting');
		add_settings_field('salesking_agents_own_orders_commission_setting', esc_html__('Earn commissions on own account orders', 'salesking'), array($this,'salesking_agents_own_orders_commission_setting_content'), 'salesking', 'salesking_main_settings_section_commission');

		// Individual agents automatic commissions
		register_setting('salesking', 'salesking_individual_agents_auto_commissions_setting');
		add_settings_field('salesking_individual_agents_auto_commissions_setting', esc_html__('Specific products belong to specific agents', 'salesking'), array($this,'salesking_individual_agents_auto_commissions_setting_content'), 'salesking', 'salesking_main_settings_section_commission');

		// Offer a different commission for prices that are increased by user
		register_setting('salesking', 'salesking_different_commission_price_increase_setting');
		add_settings_field('salesking_different_commission_price_increase_setting', esc_html__('Different commission when agent increases price', 'salesking'), array($this,'salesking_different_commission_price_increase_setting_content'), 'salesking', 'salesking_main_settings_section_commission');

		// Take out discount from agent's commission
		register_setting('salesking', 'salesking_take_out_discount_agent_commission_setting');
		add_settings_field('salesking_take_out_discount_agent_commission_setting', esc_html__('Take out discounts from agents\' commission', 'salesking'), array($this,'salesking_take_out_discount_agent_commission_setting_content'), 'salesking', 'salesking_main_settings_section_commission');

		// Hide individual users in rules
		register_setting('salesking', 'salesking_hide_users_commission_rules_setting');
		add_settings_field('salesking_hide_users_commission_rules_setting', esc_html__('Commission rules: hide individual users', 'salesking'), array($this,'salesking_hide_users_commission_rules_setting_content'), 'salesking', 'salesking_main_settings_section_commission');

		// Commissions are calculated based on profit
		register_setting('salesking', 'salesking_commissions_calculated_based_profit_setting');
		add_settings_field('salesking_commissions_calculated_based_profit_setting', esc_html__('Profit-based commission calculation', 'salesking'), array($this,'salesking_commissions_calculated_based_profit_setting_content'), 'salesking', 'salesking_main_settings_section_commission');

		register_setting('salesking', 'salesking_different_commission_price_increase_number_setting');
		register_setting('salesking', 'salesking_enable_custom_payouts_title_setting');
		register_setting('salesking', 'salesking_enable_custom_payouts_description_setting');

		do_action('salesking_register_settings');

	}

	function salesking_hide_users_commission_rules_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_hide_users_commission_rules_setting" value="1" '.checked(1,get_option( 'salesking_hide_users_commission_rules_setting', 1 ), false).'">
		  <label>'.esc_html__('For large numbers of users, this prevents crashes.','salesking').'</label>
		</div>
		';
	}

	function salesking_tables_language_option_setting_content(){
		?>

		<div class="ui fluid search selection dropdown salesking_tables_language_option_setting">
		  <input type="hidden" name="salesking_tables_language_option_setting">
		  <i class="dropdown icon"></i>
		  <div class="default text"><?php esc_html_e('Select Country','salesking'); ?></div>
		  <div class="menu">
		  <div class="item" data-value="English"><i class="uk flag"></i>English</div>
		  <div class="item" data-value="Afrikaans"><i class="za flag"></i>Afrikaans</div>
		  <div class="item" data-value="Albanian"><i class="al flag"></i>Albanian</div>
		  <div class="item" data-value="Arabic"><i class="dz flag"></i>Arabic</div>
		  <div class="item" data-value="Armenian"><i class="am flag"></i>Armenian</div>
		  <div class="item" data-value="Azerbaijan"><i class="az flag"></i>Azerbaijan</div>
		  <div class="item" data-value="Bangla"><i class="bd flag"></i>Bangla</div>
		  <div class="item" data-value="Basque"><i class="es flag"></i>Basque</div>
		  <div class="item" data-value="Belarusian"><i class="by flag"></i>Belarusian</div>
		  <div class="item" data-value="Bulgarian"><i class="bg flag"></i>Bulgarian</div>
		  <div class="item" data-value="Catalan"><i class="es flag"></i>Catalan</div>
		  <div class="item" data-value="Chinese"><i class="cn flag"></i>Chinese</div>
		  <div class="item" data-value="Chinese-traditional"><i class="cn flag"></i>Chinese Traditional</div>
		  <div class="item" data-value="Croatian"><i class="hr flag"></i>Croatian</div>
		  <div class="item" data-value="Czech"><i class="cz flag"></i>Czech</div>
		  <div class="item" data-value="Danish"><i class="dk flag"></i>Danish</div>
		  <div class="item" data-value="Dutch"><i class="nl flag"></i>Dutch</div>
		  <div class="item" data-value="Estonian"><i class="ee flag"></i>Estonian</div>
		  <div class="item" data-value="Filipino"><i class="ph flag"></i>Filipino</div>
		  <div class="item" data-value="Finnish"><i class="fi flag"></i>Finnish</div>
		  <div class="item" data-value="French"><i class="fr flag"></i>French</div>
		  <div class="item" data-value="Galician"><i class="es flag"></i>Galician</div>
		  <div class="item" data-value="Georgian"><i class="ge flag"></i>Georgian</div>
		  <div class="item" data-value="German"><i class="de flag"></i>German</div>
		  <div class="item" data-value="Greek"><i class="gr flag"></i>Greek</div>
		  <div class="item" data-value="Hebrew"><i class="il flag"></i>Hebrew</div>
		  <div class="item" data-value="Hindi"><i class="in flag"></i>Hindi</div>
		  <div class="item" data-value="Hungarian"><i class="hu flag"></i>Hungarian</div>
		  <div class="item" data-value="Icelandic"><i class="is flag"></i>Icelandic</div>
		  <div class="item" data-value="Indonesian"><i class="id flag"></i>Indonesian</div>
		  <div class="item" data-value="Italian"><i class="it flag"></i>Italian</div>
		  <div class="item" data-value="Japanese"><i class="jp flag"></i>Japanese</div>
		  <div class="item" data-value="Kazakh"><i class="kz flag"></i>Kazakh</div>
		  <div class="item" data-value="Korean"><i class="kr flag"></i>Korean</div>
		  <div class="item" data-value="Kyrgyz"><i class="kg flag"></i>Kyrgyz</div>
		  <div class="item" data-value="Latvian"><i class="lv flag"></i>Latvian</div>
		  <div class="item" data-value="Lithuanian"><i class="lt flag"></i>Lithuanian</div>
		  <div class="item" data-value="Macedonian"><i class="mk flag"></i>Macedonian</div>
		  <div class="item" data-value="Malay"><i class="my flag"></i>Malay</div>
		  <div class="item" data-value="Mongolian"><i class="mn flag"></i>Mongolian</div>
		  <div class="item" data-value="Nepali"><i class="np flag"></i>Nepali</div>
		  <div class="item" data-value="Norwegian"><i class="no flag"></i>Norwegian</div>
		  <div class="item" data-value="Polish"><i class="pl flag"></i>Polish</div>
		  <div class="item" data-value="Portuguese"><i class="pt flag"></i>Portuguese</div>
		  <div class="item" data-value="Romanian"><i class="ro flag"></i>Romanian</div>
		  <div class="item" data-value="Russian"><i class="ru flag"></i>Russian</div>
		  <div class="item" data-value="Serbian"><i class="cs flag"></i>Serbian</div>
		  <div class="item" data-value="Slovak"><i class="sk flag"></i>Slovak</div>
		  <div class="item" data-value="Slovenian"><i class="si flag"></i>Slovenian</div>
		  <div class="item" data-value="Spanish"><i class="es flag"></i>Spanish</div>
		  <div class="item" data-value="Swedish"><i class="se flag"></i>Swedish</div>
		  <div class="item" data-value="Thai"><i class="th flag"></i>Thai</div>
		  <div class="item" data-value="Turkish"><i class="tr flag"></i>Turkish</div>
		  <div class="item" data-value="Ukrainian"><i class="ua flag"></i>Ukrainian</div>
		  <div class="item" data-value="Uzbek"><i class="uz flag"></i>Uzbek</div>
		  <div class="item" data-value="Vietnamese"><i class="vn flag"></i>Vietnamese</div>
		</div>
		 </div>
		<?php	
	}

	

	function salesking_commissions_calculated_including_tax_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_commissions_calculated_including_tax_setting" value="1" '.checked(1,get_option( 'salesking_commissions_calculated_including_tax_setting', 1 ), false).'">
		  <label>'.esc_html__('Commission calculation is based on price including tax.','salesking').'</label>
		</div>
		';
	}


	function salesking_substract_subagent_earnings_agent_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_substract_subagent_earnings_agent_setting" value="1" '.checked(1,get_option( 'salesking_substract_subagent_earnings_agent_setting', 0 ), false).'">
		  <label>'.esc_html__('Parent agent commission (agent recruiter) is substracted from the agent commission.','salesking').'</label>
		</div>
		';
	}

	function salesking_agents_own_orders_commission_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_agents_own_orders_commission_setting" value="1" '.checked(1,get_option( 'salesking_agents_own_orders_commission_setting', 0 ), false).'">
		  <label>'.esc_html__('Agents will earn commissions on orders they place with their own account.','salesking').'</label>
		</div>
		';
	}

	function salesking_individual_agents_auto_commissions_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_individual_agents_auto_commissions_setting" value="1" '.checked(1,get_option( 'salesking_individual_agents_auto_commissions_setting', 0 ), false).'">
		  <label>'.esc_html__('For commission rules that apply to individual agents, all products sold automatically give commissions to those agents.','salesking').'</label>
		</div>
		';
	}

	function salesking_take_out_discount_agent_commission_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_take_out_discount_agent_commission_setting" value="1" '.checked(1,get_option( 'salesking_take_out_discount_agent_commission_setting', 0 ), false).'">
		  <label>'.esc_html__('When agents edit prices in cart to offer discounts (if enabled), take out discount value from the agents\' commission.','salesking').'</label>
		</div>
		';
	}

	function salesking_commissions_calculated_based_profit_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_commissions_calculated_based_profit_setting" value="1" '.checked(1,get_option( 'salesking_commissions_calculated_based_profit_setting', 0 ), false).'">
		  <label>'.esc_html__('Commission calculation is based on profit (cost of products has to be entered for each product /variation).','salesking').' <br><a href="https://wordpress.org/plugins/cost-of-goods-for-woocommerce/" class="salesking_costofgoods_plugin_label">'.esc_html__('Requires "Cost of Goods" plugin active.','salesking').'</a></label>
		</div>
		';
	}


	function salesking_agents_can_edit_prices_increase_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_agents_can_edit_prices_increase_setting" value="1" '.checked(1,get_option( 'salesking_agents_can_edit_prices_increase_setting', 1 ), false).'">
		  <label>'.esc_html__('When agents order on behalf of customers, they can edit prices to increase price, and win the difference as profit.','salesking').'</label>
		</div>
		';
	}

	function salesking_all_agents_shop_all_customers_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_all_agents_shop_all_customers_setting" value="1" '.checked(1,get_option( 'salesking_all_agents_shop_all_customers_setting', 0 ), false).'">
		  <label>'.esc_html__('All agents will see all customers and be able to manage them / place order for them.','salesking').'</label>
		</div>
		';
	}

	function salesking_agents_can_edit_prices_discounts_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_agents_can_edit_prices_discounts_setting" value="1" '.checked(1,get_option( 'salesking_agents_can_edit_prices_discounts_setting', 1 ), false).'">
		  <label>'.esc_html__('When agents order on behalf of customers, they can edit prices to offer discounts.','salesking').'</label>
		</div>
		';
	}

	function salesking_different_commission_price_increase_setting_content(){
		// get visibility status
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_different_commission_price_increase_setting" value="1" '.checked(1,get_option( 'salesking_different_commission_price_increase_setting', 1 ), false).'">
		  <label></label>
		</div>
		<br>
		<div id="salesking_custom_commission_container">
			<input type="number" min="1" step="0.01" max="100" name="salesking_different_commission_price_increase_number_setting" value="'.get_option( 'salesking_different_commission_price_increase_number_setting', 100 ).'" placeholder="'.esc_html__('Enter commission percentage...','salesking').'" id="salesking_different_commission_price_increase_number_setting"><br >
		</div>
		';
	}

	function salesking_license_email_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" class="salesking_license_field" name="salesking_license_email_setting" value="'.esc_attr(get_option('salesking_license_email_setting', '')).'">
			</div>
		</div>
		';
	}


	function salesking_license_key_setting_content(){
		echo '
		<div class="ui form">
			<div class="field">
				<input type="text" class="salesking_license_field" name="salesking_license_key_setting" value="'.esc_attr(get_option('salesking_license_key_setting', '')).'">
			</div>
		</div>
		';
	}

	function salesking_enable_custom_payouts_setting_content(){
		// get visibility status
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_custom_payouts_setting" value="1" '.checked(1,get_option( 'salesking_enable_custom_payouts_setting', 0 ), false).'">
		  <label></label>
		</div>
		<br>
		<div id="salesking_custom_method_container">
			<input type="text" name="salesking_enable_custom_payouts_title_setting" value="'.esc_html(get_option( 'salesking_enable_custom_payouts_title_setting', '' )).'" placeholder="'.esc_html__('Enter method title here...','salesking').'" id="salesking_custom_method_title"><br >
			<textarea name="salesking_enable_custom_payouts_description_setting" placeholder="'.esc_html__('Enter method description / instructions here...','salesking').'" id="salesking_custom_method_description">'.esc_html(get_option( 'salesking_enable_custom_payouts_description_setting', '' )).'</textarea>
		</div>
		';
	}

	function salesking_enable_bank_payouts_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_bank_payouts_setting" value="1" '.checked(1,get_option( 'salesking_enable_bank_payouts_setting', 0 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_enable_paypal_payouts_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_paypal_payouts_setting" value="1" '.checked(1,get_option( 'salesking_enable_paypal_payouts_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_change_color_scheme_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_change_color_scheme_setting" value="1" '.checked(1,get_option( 'salesking_change_color_scheme_setting', 0 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_main_dashboard_color_setting_content(){
		?>
		<input name="salesking_main_dashboard_color_setting" type="color" value="<?php echo esc_attr( get_option( 'salesking_main_dashboard_color_setting', '#854fff' ) ); ?>">
		<?php
	}

	function salesking_main_dashboard_hover_color_setting_content(){
		?>
		<input name="salesking_main_dashboard_hover_color_setting" type="color" value="<?php echo esc_attr( get_option( 'salesking_main_dashboard_hover_color_setting', '#6a29ff' ) ); ?>">
		<?php
	}

	function salesking_agents_can_edit_customers_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_agents_can_edit_customers_setting" value="1" '.checked(1,get_option( 'salesking_agents_can_edit_customers_setting', 1 ), false).'">
		  <label>'.esc_html__('Agents can edit customer profiles.','salesking').'</label>
		</div>
		';
	}

	function salesking_agents_can_manage_orders_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_agents_can_manage_orders_setting" value="1" '.checked(1,get_option( 'salesking_agents_can_manage_orders_setting', 1 ), false).'">
		  <label>'.esc_html__('Agents can manage, change status, and edit orders assigned to them.','salesking').'</label>
		</div>
		';
	}

	function salesking_agents_receive_order_emails_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_agents_receive_order_emails_setting" value="1" '.checked(1,get_option( 'salesking_agents_receive_order_emails_setting', 1 ), false).'">
		  <label>'.esc_html__('Agents are notified via email when an order has been assigned to them.','salesking').'</label>
		</div>
		';
	}

	function salesking_enable_random_assign_agent_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_random_assign_agent_setting" value="1" '.checked(1,get_option( 'salesking_enable_random_assign_agent_setting', 0 ), false).'">
		  <label>'.esc_html__('If no agent is chosen at registration, assign the user automatically to an agent.','salesking').'</label>
		</div>
		';
	}

	function salesking_enable_agent_id_registration_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_agent_id_registration_setting" value="1" '.checked(1,get_option( 'salesking_enable_agent_id_registration_setting', 1 ), false).'">
		  <label>'.esc_html__('This gives users the option to enter an agent ID at registration.','salesking').'</label>
		</div>
		';
	}

	function salesking_enable_agent_id_registration_dropdown_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_agent_id_registration_dropdown_setting" value="1" '.checked(1,get_option( 'salesking_enable_agent_id_registration_dropdown_setting', 0 ), false).'">
		  <label>'.esc_html__('This gives users the option to choose an agent from a dropdown of all existing agents.','salesking').'</label>
		</div>
		';
	}

	function salesking_enable_announcements_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_announcements_setting" value="1" '.checked(1,get_option( 'salesking_enable_announcements_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_enable_cart_sharing_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_cart_sharing_setting" value="1" '.checked(1,get_option( 'salesking_enable_cart_sharing_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_enable_affiliate_links_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_affiliate_links_setting" value="1" '.checked(1,get_option( 'salesking_enable_affiliate_links_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_enable_earnings_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_earnings_setting" value="1" '.checked(1,get_option( 'salesking_enable_earnings_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_enable_messages_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_messages_setting" value="1" '.checked(1,get_option( 'salesking_enable_messages_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_enable_teams_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_teams_setting" value="1" '.checked(1,get_option( 'salesking_enable_teams_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}


	function salesking_enable_teams_levels_setting_content(){

		echo '
			<div data-tooltip="'.esc_html__('Enter how many levels of agents can have subagents. 0 = unlimited', 'salesking').'" data-inverted="" data-position="top left">
			    <input type="number" name="salesking_enable_teams_levels_setting" min="0" id="salesking_enable_teams_levels_setting" class="regular-text" value="'.esc_attr(get_option('salesking_enable_teams_levels_setting',0)).'">
			</div>';
	}

	function salesking_enable_payouts_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_payouts_setting" value="1" '.checked(1,get_option( 'salesking_enable_payouts_setting', 1 ), false).'">
		  <label>'.esc_html__('Disable this if you want to manage payouts separate of SalesKing.','salesking').'</label>
		</div>
		';
	}

	function salesking_enable_coupons_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_coupons_setting" value="1" '.checked(1,get_option( 'salesking_enable_coupons_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_enable_offers_setting_content(){
		echo '
		<div class="ui toggle checkbox">
		  <input type="checkbox" name="salesking_enable_offers_setting" value="1" '.checked(1,get_option( 'salesking_enable_offers_setting', 1 ), false).'">
		  <label></label>
		</div>
		';
	}

	function salesking_current_tab_setting_content(){
		echo '
		 <input type="hidden" id="salesking_current_tab_setting_input" name="salesking_current_tab_setting" value="'.esc_attr(get_option( 'salesking_current_tab_setting', 'accessrestriction' )).'">
		';
	}

	function salesking_logo_setting_content(){
		echo '
			<div>
			    <input type="text" name="salesking_logo_setting" id="salesking_logo_setting" class="regular-text" placeholder="'.esc_attr__('Your Custom Logo', 'salesking').'" value="'.esc_attr(get_option('salesking_logo_setting','')).'"><br><br>
			    <input type="button" name="salesking-upload-btn" id="salesking-upload-btn" class="ui blue button" value="'.esc_attr__('Select Image','salesking').'">
			</div>
		';
	}

	function salesking_logo_favicon_setting_content(){
		echo '
			<div>
			    <input type="text" name="salesking_logo_favicon_setting" id="salesking_logo_favicon_setting" class="regular-text" placeholder="'.esc_attr__('Your Custom Favicon', 'salesking').'" value="'.esc_attr(get_option('salesking_logo_favicon_setting','')).'"><br><br>
			    <input type="button" name="salesking-upload-btn-favicon" id="salesking-upload-btn-favicon" class="ui blue button" value="'.esc_attr__('Select Image','salesking').'">
			</div>
		';
	}

	function salesking_agents_page_setting_content(){
		echo '<select name="salesking_agents_page_setting">';
		  	
		// get pages
		$pages = get_pages();
		foreach ($pages as $page){
			echo '<option value="'.esc_attr($page->ID).'" '.selected($page->ID, apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true), false).'">'.esc_html($page->post_title).'</option>';
		}

		echo'</select>';

	}
		
	public function render_settings_page_content() {
		?>

		<!-- Admin Menu Page Content -->
		<form id="salesking_admin_form" method="POST" action="options.php">
			<?php settings_fields('salesking'); ?>
			<?php do_settings_fields( 'salesking', 'salesking_hiddensettings' ); ?>

			<div id="salesking_admin_wrapper" >

				<!-- Admin Menu Tabs --> 
				<div id="salesking_admin_menu" class="ui labeled stackable large vertical menu attached">
					<img id="salesking_menu_logo" src="<?php 

					$custom_logo = 'no';
					if (defined('SALESKINGLABEL_DIR')){
						if (!empty(get_option('salesking_whitelabel_logo_setting',''))){
							$custom_logo = get_option('salesking_whitelabel_logo_setting','');
						}
					}

					if ($custom_logo === 'no'){
						$custom_logo = plugins_url('../includes/assets/images/saleskinglogo3.png', __FILE__);
					}
					
					echo $custom_logo; 

				?>">
					<a class="green item <?php echo $this->salesking_isactivetab('mainsettings'); ?>" data-tab="mainsettings">
						<i class="power off icon"></i>
						<div class="header"><?php esc_html_e('Main Settings','salesking'); ?></div>
						<span class="salesking_menu_description"><?php esc_html_e('Primary plugin settings','salesking'); ?></span>
					</a>

					<a class="green item <?php echo $this->salesking_isactivetab('registration'); ?>" data-tab="registration">
						<i class="user plus icon"></i>
						<div class="header"><?php esc_html_e('Registration','salesking'); ?></div>
						<span class="salesking_menu_description"><?php esc_html_e('Registration settings','salesking'); ?></span>
					</a>
					<a class="green item <?php echo $this->salesking_isactivetab('agentcapabilities'); ?>" data-tab="agentcapabilities">
						<i class="id badge icon"></i>
						<div class="header"><?php esc_html_e('Agent Capabilities','salesking'); ?></div>
						<span class="salesking_menu_description"><?php esc_html_e('Agent settings','salesking'); ?></span>
					</a>
					<a class="green item <?php 
						if (intval(get_option( 'salesking_enable_payouts_setting', 1 )) !== 1){ 
							echo 'salesking_othersettings_margin ';
						}
						echo $this->salesking_isactivetab('commission'); 
					?>" data-tab="commission">
						<i class="chart pie icon"></i>
						<div class="header"><?php esc_html_e('Commission calculation','salesking'); ?></div>
						<span class="salesking_menu_description"><?php esc_html_e('Commission settings','salesking'); ?></span>
					</a>

					<?php if (intval(get_option( 'salesking_enable_payouts_setting', 1 )) === 1){
						?>
						<a class="green item <?php echo $this->salesking_isactivetab('payouts'); ?>" data-tab="payouts">
							<i class="envelope open icon"></i>
							<div class="header"><?php esc_html_e('Payouts','salesking'); ?></div>
							<span class="salesking_menu_description"><?php esc_html_e('Payout settings','salesking'); ?></span>
						</a>
						<?php
					}
					?>

					<a class="green item  <?php echo $this->salesking_isactivetab('tools'); ?>" data-tab="tools">
						<i class="wrench icon"></i>
						<div class="header"><?php esc_html_e('Tools','salesking'); ?></div>
						<span class="salesking_menu_description"><?php esc_html_e('Tools & User Management','salesking'); ?></span>
					</a>

					<?php
					do_action('salesking_settings_panel_end_items');
					?>

				
					<?php
					if (apply_filters('salesking_license_show', true)){
						?>
						<a class="green item salesking_license salesking_othersettings_margin <?php  echo $this->salesking_isactivetab('license'); ?>" data-tab="license">
							<i class="key icon"></i>
							<div class="header"><?php  esc_html_e('License','salesking'); ?></div>
							<span class="salesking_menu_description"><?php esc_html_e('Manage plugin license','salesking'); ?></span>
						</a>
						<?php
					}
					?>
					

					
				</div>
			
				<!-- Admin Menu Tabs Content--> 
				<div id="salesking_tabs_wrapper">

					<!-- Main Settings Tab--> 
					<div class="ui bottom attached tab segment <?php echo $this->salesking_isactivetab('mainsettings'); ?>" data-tab="mainsettings">
						<div class="salesking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="power off icon"></i>
								<div class="content">
									<?php esc_html_e('Main Settings','salesking'); ?>
									<div class="sub header">
										<?php esc_html_e('Configure SalesKing','salesking'); ?>
									</div>
								</div>
							</h2>

							<h3 class="ui block header"><i class="laptop icon"></i><?php esc_html_e('Dashboard','salesking');?></h3>
							
							<table class="form-table">
								<?php do_settings_fields( 'salesking', 'salesking_main_settings_section_dashboard' ); ?>
							</table>

							<table class="form-table salesking_change_color_scheme_container">
								<?php do_settings_fields( 'salesking', 'salesking_vendordash_color_fields_settings_section' ); ?>
							</table>

							<h3 class="ui block header"><i class="plug icon"></i><?php esc_html_e('Modules','salesking');?></h3>
							<table class="form-table">
								<?php do_settings_fields( 'salesking', 'salesking_main_settings_section_modules' ); ?>
							</table>

							<h3 class="ui block header">
								<i class="list alternate icon"></i>
								<?php esc_html_e('Tables Language','salesking'); ?>
							</h3>
							<table class="form-table">
								<?php do_settings_fields( 'salesking', 'salesking_language_settings_section' ); ?>
							</table>
						</div>
					</div>
					
					<!-- Registration Tab--> 
					<div class="ui bottom attached tab segment <?php echo $this->salesking_isactivetab('registration'); ?>" data-tab="registration">
						<div class="salesking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="user plus icon"></i>
								<div class="content">
									<?php esc_html_e('Registration Settings','salesking'); ?>
									<div class="sub header">
										<?php esc_html_e('Agent and customer registration','salesking'); ?>
									</div>
								</div>
							</h2>
						
							<table class="form-table salesking_registration_settings_section">
								<?php do_settings_fields( 'salesking', 'salesking_main_settings_section_registration' ); ?>
							</table>

						</div>
					</div>

					<!-- Agent Capabilities Tab--> 
					<div class="ui bottom attached tab segment <?php echo $this->salesking_isactivetab('agentcapabilities'); ?>" data-tab="agentcapabilities">
						<div class="salesking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="id badge icon"></i>
								<div class="content">
									<?php esc_html_e('Agent Capabilities','salesking'); ?>
									<div class="sub header">
										<?php esc_html_e('Control what abilities agents have','salesking'); ?>
									</div>
								</div>
							</h2>
						
							<table class="form-table">
								<?php do_settings_fields( 'salesking', 'salesking_main_settings_section_agentcapabilities' ); ?>
							</table>

						</div>
					</div>

					<!-- Commission Calc Tab--> 
					<div class="ui bottom attached tab segment <?php echo $this->salesking_isactivetab('commission'); ?>" data-tab="commission">
						<div class="salesking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="chart pie icon"></i>
								<div class="content">
									<?php esc_html_e('Commission Calculation','salesking'); ?>
									<div class="sub header">
										<?php esc_html_e('Control how agent commission is calculated','salesking'); ?>
									</div>
								</div>
							</h2>
						
							<table class="form-table">
								<?php do_settings_fields( 'salesking', 'salesking_main_settings_section_commission' ); ?>
							</table>

						</div>
					</div>

					<!-- Payouts Tab--> 
					<div class="ui bottom attached tab segment <?php echo $this->salesking_isactivetab('payouts'); ?>" data-tab="payouts">
						<div class="salesking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="envelope open icon"></i>
								<div class="content">
									<?php esc_html_e('Payouts','salesking'); ?>
									<div class="sub header">
										<?php esc_html_e('Control available payout options','salesking'); ?>
									</div>
								</div>
							</h2>
						
							<table class="form-table">
								<?php do_settings_fields( 'salesking', 'salesking_main_settings_section_payouts' ); ?>
							</table>

						</div>
					</div>

					<!-- License Tab--> 
					<div class="ui bottom attached tab segment <?php echo $this->salesking_isactivetab('license'); ?>" data-tab="license">
						<div class="salesking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="key icon"></i>
								<div class="content">
									<?php esc_html_e('License management','salesking'); ?>
									<div class="sub header">
										<?php esc_html_e('Activate the plugin','salesking'); ?>
									</div>
								</div>
							</h2>
							<table class="form-table">
								<?php do_settings_fields( 'salesking', 'salesking_license_settings_section' ); ?>
							</table>
							<!-- License Status -->
							<?php
							$license = get_option('salesking_license_key_setting', '');
							$email = get_option('salesking_license_email_setting', '');
							$info = parse_url(get_site_url());
							$host = $info['host'];
							$host_names = explode(".", $host);
							$bottom_host_name = $host_names[count($host_names)-2] . "." . $host_names[count($host_names)-1];

							if (strlen($host_names[count($host_names)-2]) <= 3){    // likely .com.au, .co.uk, .org.uk etc
								if (isset($host_names[count($host_names)-3])){
								    $bottom_host_name_new = $host_names[count($host_names)-3] . "." . $host_names[count($host_names)-2] . "." . $host_names[count($host_names)-1];
								    
								    $bottom_host_name = $bottom_host_name_new;
								}
							}

							
							$activation = get_option('pluginactivation_'.$email.'_'.$license.'_'.$bottom_host_name);

							if ($activation == 'active'){

								$license_email_display = $this->mask_email(get_option('salesking_license_email_setting', ''));
								$license_key_display = $this->mask_license_key(get_option('salesking_license_key_setting', ''));

								// show blurred license details
								?>
								<table class="form-table">
									<tbody><tr><th scope="row"><?php esc_html_e('License email','salesking');?></th><td>
										<div class="ui form">
											<div class="field">
												<input type="text" class="salesking_license_field" value="<?php echo esc_attr($license_email_display);?>" disabled="disabled">
											</div>
										</div>
										</td></tr><tr><th scope="row"><?php esc_html_e('License key','salesking');?></th><td>
										<div class="ui form">
											<div class="field">
												<input type="text" class="salesking_license_field" value="<?php echo esc_attr($license_key_display);?>" disabled="disabled">
											</div>
										</div>
										</td></tr>							
									</tbody>
								</table>
								
								<div class="ui success message salesking_license_active">
								  <div class="header">
								    <?php esc_html_e('Your license is valid and active','salesking'); ?>
								  </div>
								  <p><?php esc_html_e('The plugin is registered to ','salesking'); echo esc_html($this->mask_email($email)); ?> </p>
								</div>
								<div id="salesking_deactivate_license" class="mini ui grey basic button">
									<i class="cut icon"></i> 
									<?php esc_html_e('Deactivate license','salesking');?>
								</div>
								<?php		
							} else {
								?>
								<button type="button" name="salesking-activate-license" id="salesking-activate-license" class="ui teal button">
									<i class="key icon"></i>
									<?php esc_html_e('Activate License', 'salesking'); ?>
								</button>

								<br><br>
								<div class="ui warning message salesking_license_active">
								  <div class="header">
								    <?php esc_html_e('Your license is not active. Activate now to receive vital plugin updates and features!','salesking'); ?>
								  </div>
								  <p>These include critical security updates, compatibility with the latest WooCommerce versions, and much more.<p>
									  <p><?php echo esc_html__('Click to learn more about','salesking').' <a target="_blank" href="https://kingsplugins.com/licensing-faq/">'.esc_html__('how to activate the plugin license','salesking').'</a>'.' or '.'<a href="https://webwizards.ticksy.com/submit/#100018188" target="_blank">'.esc_html__('contact support','salesking').'.</a>';;?></p>
								</div>
								<?php

								if (!empty($email) && isset($_GET['tab'])){
									if ($_GET['tab'] === 'activate'){											
										add_action('admin_footer', function(){
										  ?>
										  <script id="profitwell-js" data-pw-auth="f178eb0b265d7a7472355c0732569f8b">
										      (function(i,s,o,g,r,a,m){i[o]=i[o]||function(){(i[o].q=i[o].q||[]).push(arguments)};
										      a=s.createElement(g);m=s.getElementsByTagName(g)[0];a.async=1;a.src=r+'?auth='+
										      s.getElementById(o+'-js').getAttribute('data-pw-auth');m.parentNode.insertBefore(a,m);
										      })(window,document,'profitwell','script','https://public.profitwell.com/js/profitwell.js');
										      
										      profitwell('start', { 'user_email': '<?php 

										      $email = get_option('salesking_license_email_setting', '');

										      echo $email; ?>' });
										  </script>
										  <?php
										});
									}
								}
							}
							?>
							<br><br><div class="ui info message">
							  <i class="close icon"></i>
							  <div class="header"> <i class="question circle icon"></i>
							  	<?php esc_html_e('Documentation','salesking'); ?>
							  </div>
							  <ul class="list">
							    <li><a href="https://kingsplugins.com/licensing-faq/" target="_blank"><?php esc_html_e('Licensing and Activation FAQ & Guide','salesking'); ?></a></li>
							    <li><a href="https://kingsplugins.com/licensing-faq#headline-66-565" target="_blank"><?php esc_html_e('How to activate if you purchased on Envato Market','b2bking'); ?></a></li>
							    <li><a href="https://kingsplugins.com/woocommerce-b2b/salesking/pricing/" target="_blank"><?php esc_html_e('Purchase a new license','salesking'); ?></a></li>

							  </ul>
							</div>
							
						</div>
					</div>
					<?php

						do_action('salesking_settings_panel_end_items_tabs');

					?>

					<!-- Tools Tab--> 
					<div class="ui bottom attached tab segment <?php echo $this->salesking_isactivetab('tools'); ?>" data-tab="tools">
						<div class="salesking_attached_content_wrapper">
							<h2 class="ui block header">
								<i class="wrench icon"></i>
								<div class="content">
									<?php esc_html_e('Tools','salesking'); ?>
									<div class="sub header">
										<?php esc_html_e('Tools to manage agents and accounts','salesking'); ?>
									</div>
								</div>
							</h2>
					
							<div id="salesking_tools_setusersubaccounts">
								<div class="salesking_user_settings_container_column_title_subaccounts">
									<i class="user plus icon salesking_subaccountplusicon"></i>

									<?php esc_html_e('Set users as subagents of an agent:','salesking'); ?>
								</div>
								<input class="salesking_set_user_subaccounts_input" type="text" placeholder="<?php esc_html_e('Enter user ids, comma-separated (example: 12,15,19)','salesking'); ?>" id="salesking_set_user_subaccounts_first" >
								<input class="salesking_set_user_subaccounts_input" type="text" placeholder="<?php esc_html_e('Enter parent agent account id (example: 23)','salesking'); ?>" id="salesking_set_user_subaccounts_second" >

								<div id="salesking_set_accounts_as_subaccounts" class="ui teal button">
									<i class="user plus icon"></i> 
									<?php esc_html_e('Set accounts as subagents of an agent','salesking');?>
								</div>
								<br><br><br>

								<div class="salesking_user_settings_container_column_title_subaccounts">
									<i class="user outline icon salesking_subaccountplusicon"></i>

									<?php esc_html_e('Turn subagents into regular agent accounts:','salesking'); ?>
								</div>
								<input class="salesking_set_user_subaccounts_input" type="text" placeholder="<?php esc_html_e('Enter user ids, comma-separated (example: 12,15,19)','salesking'); ?>" id="salesking_set_subaccounts_regular_input" >

								<div id="salesking_set_subaccounts_regular_button" class="ui teal button">
									<i class="user outline icon"></i> 
									<?php esc_html_e('Set accounts','salesking');?>
								</div>

								<br><br><br>

								<div class="salesking_user_settings_container_column_title_subaccounts">
									<i class="user circle icon salesking_subaccountplusicon"></i>

									<?php esc_html_e('Set an agent for all customers:','salesking'); ?>
								</div>
			    				<select name="salesking_setagent" id="salesking_setagent" class="salesking_user_settings_select">
		    					<optgroup label="<?php esc_html_e('Agents', 'salesking'); ?>">
		    						<option value="none" ><?php esc_html_e('No agent (remove agent)','salesking');?></option>
				    				<?php 
				    					$agents = get_users(array(
						    			    'meta_key'     => 'salesking_group',
						    			    'meta_value'   => 'none',
						    			    'meta_compare' => '!=',
						    			));
				    					foreach ($agents as $agent){
				    						$name = $agent->first_name.' '.$agent->last_name;
				    						if (!empty(trim($name))){
				    							$name = '( '.$name.' )';
				    						}
				    						echo '<option value="'.esc_attr($agent->ID).'" >'.esc_html($agent->user_login.$name).'</option>';

				    					}
				    				?>
		    					</optgroup>
			    				</select>
			    				<br>
		  			  			<div id="salesking_setagent_button" class="ui teal button">
		  			  				<i class="building icon"></i> 
		  			  				<?php esc_html_e('Set agent','salesking');?>
		  			  			</div>

							</div>

							<table class="form-table">
								<?php do_settings_fields( 'salesking', 'salesking_main_settings_section_tools' ); ?>
							</table>

						</div>
					</div>

					
				</div>
			</div>

			<br>
			<input type="submit" name="submit" id="salesking-admin-submit" class="ui primary button" value="<?php echo esc_attr_e('Save Settings', 'salesking');?>">
		</form>

		<?php
	}

	function mask_email($email) {
	    $email_parts = explode('@', $email);
	    $local_part = $email_parts[0];
	    $domain_part = $email_parts[1];

	    // Mask the local part, show only first and last character
	    $masked_local_part = substr($local_part, 0, 1) . str_repeat('*', strlen($local_part) - 2) . substr($local_part, -1);

	    return $masked_local_part . '@' . $domain_part;
	}

	// Function to mask part of the license key
	function mask_license_key($license_key) {
	    // Show first 4 and last 4 characters, mask the middle part
	    return substr($license_key, 0, 4) . str_repeat('*', strlen($license_key) - 8) . substr($license_key, -4);
	}

	function salesking_isactivetab($tab){
		$gototab = get_option( 'salesking_current_tab_setting', 'mainsettings' );
		if ($tab === $gototab){
			return 'active';
		} 
	}

}