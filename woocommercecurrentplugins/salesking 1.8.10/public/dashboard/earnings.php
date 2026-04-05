<?php
if (intval(get_option( 'salesking_enable_earnings_setting', 1 )) === 1){
    ?>
    <div class="nk-content salesking_earnings_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="nk-block-head nk-block-head-sm">
                        <div class="nk-block-between">
                            <div class="nk-block-head-content">
                                <h3 class="nk-block-title page-title"><?php esc_html_e('Earnings','salesking');?></h3>
                                <div class="nk-block-des text-soft">
                                    <p><?php esc_html_e('Here you can view and keep track of your earnings.', 'salesking');?></p>
                                </div>
                            </div><!-- .nk-block-head-content -->
                            <div class="nk-block-head-content">
                                <div class="toggle-wrap nk-block-tools-toggle">
                                    <a href="#" class="btn btn-icon btn-trigger toggle-expand mr-n1" data-target="pageMenu"><em class="icon ni ni-more-v"></em></a>
                                    <div class="toggle-expand-content" data-content="pageMenu">
                                        
                                    </div>
                                </div>
                            </div><!-- .nk-block-head-content -->
                        </div><!-- .nk-block-between -->
                    </div><!-- .nk-block-head -->
                    <div class="nk-block">
                        <div class="row g-gs">
                            <div class="<?php echo esc_attr(apply_filters('salesking_earnings_card_classes', 'col-xxl-4 col-sm-6'));?>">

                                <div class="card">
                                    <div class="nk-ecwg nk-ecwg6">
                                        <div class="card-inner">
                                            <div class="card-title-group">
                                                <div class="card-title">
                                                    <h6 class="title"><?php esc_html_e('Earnings this month','salesking');?></h6>
                                                </div>
                                            </div>
                                            <div class="data">
                                                <div class="data-group">
                                                    <div class="amount"><?php
                                                    $site_time = time()+(get_option('gmt_offset')*3600);
                                                    $current_day = date_i18n( 'd', $site_time );

                                                    $earnings_number = 0;
                                                    $earnings = get_posts( array( 
                                                        'post_type' => 'salesking_earning',
                                                        'numberposts' => -1,
                                                        'post_status'    => 'any',
                                                        'date_query' => array(
                                                                'after' => date('Y-m-d', strtotime('-'.$current_day.' days')) 
                                                            ),
                                                        'fields'    => 'ids',
                                                        'meta_key'   => 'agent_id',
                                                        'meta_value' => get_current_user_id(),
                                                    ));

                                                    foreach ($earnings as $earning_id){
                                                        $order_id = get_post_meta($earning_id,'order_id', true);
                                                        $orderobj = wc_get_order($order_id);
                                                        if ($orderobj !== false){
                                                            $status = $orderobj->get_status();
                                                            $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
                                                            // check if approved
                                                            if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                $earnings_number+=$earnings_total;
                                                            }
                                                        }
                                                    }

                                                    // also get all earnings where this agent is parent
                                                    $earnings = get_posts( array( 
                                                        'post_type' => 'salesking_earning',
                                                        'numberposts' => -1,
                                                        'post_status'    => 'any',
                                                        'date_query' => array(
                                                                'after' => date('Y-m-d', strtotime('-'.$current_day.' days')) 
                                                            ),
                                                        'fields'    => 'ids',
                                                        'meta_key'   => 'parent_agent_id_'.get_current_user_id(),
                                                        'meta_value' => get_current_user_id(),
                                                    ));

                                                    foreach ($earnings as $earning_id){
                                                        $order_id = get_post_meta($earning_id,'order_id', true);
                                                        $orderobj = wc_get_order($order_id);
                                                        if ($orderobj !== false){
                                                            $status = $orderobj->get_status();
                                                            $earnings_total = get_post_meta($earning_id,'parent_agent_id_'.get_current_user_id().'_earnings', true);
                                                            // check if approved
                                                            if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                $earnings_number+=$earnings_total;
                                                            }
                                                        }
                                                    }

                                                    $multicurrency = false;

                                                    if (defined('WOOCS_VERSION')) {
                                                        // base woocs currency
                                                        global $WOOCS;
                                                        echo $WOOCS->default_currency.' '.$earnings_number;
                                                        $multicurrency = true;
                                                    }

                                                    if (defined('WOOMULTI_CURRENCY_F_DIR') || defined('WOOMULTI_CURRENCY_DIR')){

                                                        if (defined('WOOMULTI_CURRENCY_F_DIR')){
                                                            $curcy_settings = WOOMULTI_CURRENCY_F_Data::get_ins();
                                                        } else {
                                                            $curcy_settings = WOOMULTI_CURRENCY_Data::get_ins();
                                                        }

                                                        $default_currency = $curcy_settings->get_default_currency();

                                                        echo $default_currency.' '.$earnings_number;

                                                        $multicurrency = true;
                                                    }

                                                    if (!$multicurrency){
                                                        echo wc_price($earnings_number);
                                                    }

                                                    ?></div>
                                                </div>
                                                <div class="info"><span><?php esc_html_e('since the start of the current month','salesking');?></span></div>
                                            </div>
                                        </div><!-- .card-inner -->
                                    </div><!-- .nk-ecwg -->
                                </div><!-- .card -->
                            </div><!-- .col -->
                            <div class="<?php echo esc_attr(apply_filters('salesking_earnings_card_classes', 'col-xxl-4 col-sm-6'));?>">
                                <div class="card">
                                    <div class="nk-ecwg nk-ecwg6">
                                        <div class="card-inner">
                                            <div class="card-title-group">
                                                <div class="card-title">
                                                    <h6 class="title"><?php esc_html_e('Earnings in the past 30 days','salesking');?></h6>
                                                </div>
                                            </div>
                                            <div class="data">
                                                <div class="data-group">
                                                    <div class="amount"><?php
                                                    $earnings_number = 0;
                                                    $earnings = get_posts( array( 
                                                        'post_type' => 'salesking_earning',
                                                        'numberposts' => -1,
                                                        'post_status'    => 'any',
                                                        'date_query' => array(
                                                                'after' => date('Y-m-d', strtotime('-30 days')) 
                                                            ),
                                                        'fields'    => 'ids',
                                                        'meta_key'   => 'agent_id',
                                                        'meta_value' => get_current_user_id(),
                                                    ));

                                                    foreach ($earnings as $earning_id){
                                                        $order_id = get_post_meta($earning_id,'order_id', true);
                                                        $orderobj = wc_get_order($order_id);
                                                        if ($orderobj !== false){
                                                            $status = $orderobj->get_status();
                                                            $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
                                                            // check if approved
                                                            if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                $earnings_number+=$earnings_total;
                                                            }
                                                        }
                                                    }

                                                    // also get all earnings where this agent is parent
                                                    $earnings = get_posts( array( 
                                                        'post_type' => 'salesking_earning',
                                                        'numberposts' => -1,
                                                        'post_status'    => 'any',
                                                        'date_query' => array(
                                                                'after' => date('Y-m-d', strtotime('-30 days')) 
                                                            ),
                                                        'fields'    => 'ids',
                                                        'meta_key'   => 'parent_agent_id_'.get_current_user_id(),
                                                        'meta_value' => get_current_user_id(),
                                                    ));

                                                    foreach ($earnings as $earning_id){
                                                        $order_id = get_post_meta($earning_id,'order_id', true);
                                                        $orderobj = wc_get_order($order_id);
                                                        if ($orderobj !== false){
                                                            $status = $orderobj->get_status();
                                                            $earnings_total = get_post_meta($earning_id,'parent_agent_id_'.get_current_user_id().'_earnings', true);
                                                            // check if approved
                                                            if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                $earnings_number+=$earnings_total;
                                                            }
                                                        }
                                                    }


                                                    $multicurrency = false;

                                                    if (defined('WOOCS_VERSION')) {
                                                        // base woocs currency
                                                        global $WOOCS;
                                                        echo $WOOCS->default_currency.' '.$earnings_number;
                                                        $multicurrency = true;
                                                    }

                                                    if (defined('WOOMULTI_CURRENCY_F_DIR') || defined('WOOMULTI_CURRENCY_DIR')){

                                                        if (defined('WOOMULTI_CURRENCY_F_DIR')){
                                                            $curcy_settings = WOOMULTI_CURRENCY_F_Data::get_ins();
                                                        } else {
                                                            $curcy_settings = WOOMULTI_CURRENCY_Data::get_ins();
                                                        }

                                                        $default_currency = $curcy_settings->get_default_currency();

                                                        echo $default_currency.' '.$earnings_number;

                                                        $multicurrency = true;
                                                    }

                                                    if (!$multicurrency){
                                                        echo wc_price($earnings_number);
                                                    }
                                                    ?></div>

                                                </div>
                                                <div class="info"><span><?php esc_html_e('over the last thirty calendar days','salesking');?></span></div>

                                            </div>
                                        </div><!-- .card-inner -->
                                    </div><!-- .nk-ecwg -->
                                </div><!-- .card -->
                            </div><!-- .col -->
                            <div class="<?php echo esc_attr(apply_filters('salesking_earnings_card_classes', 'col-xxl-4 col-sm-6'));?>">
                                <div class="card">
                                    <div class="nk-ecwg nk-ecwg6">
                                        <div class="card-inner">
                                            <div class="card-title-group">
                                                <div class="card-title">
                                                    <h6 class="title"><?php esc_html_e('Balance available','salesking');?></h6>
                                                </div>
                                            </div>
                                            <div class="data">
                                                <div class="data-group">
                                                    <div class="amount"><?php
                                                    $outstanding_balance = get_user_meta($user_id,'salesking_outstanding_earnings', true);
                                                    if (empty($outstanding_balance)){
                                                        $outstanding_balance = 0;
                                                    }

                                                    $multicurrency = false;

                                                    if (defined('WOOCS_VERSION')) {
                                                        // base woocs currency
                                                        global $WOOCS;
                                                        echo $WOOCS->default_currency.' '.$outstanding_balance;
                                                        $multicurrency = true;
                                                    }

                                                    if (defined('WOOMULTI_CURRENCY_F_DIR') || defined('WOOMULTI_CURRENCY_DIR')){

                                                        if (defined('WOOMULTI_CURRENCY_F_DIR')){
                                                            $curcy_settings = WOOMULTI_CURRENCY_F_Data::get_ins();
                                                        } else {
                                                            $curcy_settings = WOOMULTI_CURRENCY_Data::get_ins();
                                                        }

                                                        $default_currency = $curcy_settings->get_default_currency();

                                                        echo $default_currency.' '.$outstanding_balance;

                                                        $multicurrency = true;
                                                    }

                                                    if (!$multicurrency){
                                                        echo wc_price($outstanding_balance);
                                                    }
                                                    ?></div>
                                                </div>
                                                <div class="info"><span><?php esc_html_e('currently available for payouts','salesking');?></span></div>
                                            </div>
                                        </div><!-- .card-inner -->
                                    </div><!-- .nk-ecwg -->
                                </div><!-- .card -->
                            </div><!-- .col -->

                            <div class="col-xxl-12">
                                <div class="card h-100">
                                    <div class="card-inner">
                                        <div class="card-title-group align-start gx-3 mb-3">
                                        </div>
                                        <div class="nk-sale-data-group align-center justify-between gy-3 gx-5">
                                            <div class="card-title">
                                                <?php
                                                 $months_removed = $id = sanitize_text_field(get_query_var('id')); // id is the number of months removed from current month
                                                 if (empty($id)){
                                                    $months_removed = $id = 0;
                                                 }

                                                ?>
                                                <h6 class="title"><?php esc_html_e('Earnings Overview','salesking');?></h6>
                                                <p><?php echo esc_html__('Earnings during ','salesking');

                                                echo ucfirst(date_i18n('F Y', strtotime('-'.$id.' months')));

                                            ?></p>

                                            </div>
                                            <div class="nk-sale-data">
                                                <span class="amount"><?php
                                                    // get month requested

                                                    $month_number = date('n', strtotime('-'.$months_removed.' months', strtotime(date("F") . "1")));
                                                    $month_year = date('Y', strtotime('-'.$months_removed.' months', strtotime(date("F") . "1")));
                                                    $days_number = date('t', mktime(0, 0, 0, $month_number, 1, $month_year)); 

                                                    $days_array = array();
                                                    $earnings_number = 0;

                                                    // get the total month earnings
                                                    $earnings = get_posts( array( 
                                                        'post_type' => 'salesking_earning',
                                                        'numberposts' => -1,
                                                        'post_status'    => 'any',
                                                        'date_query' => array(
                                                            'year'  => $month_year,
                                                            'month' => $month_number,
                                                        ),
                                                        'meta_key'   => 'agent_id',
                                                        'meta_value' => get_current_user_id(),
                                                    ));

                                                    foreach ($earnings as $earning){
                                                        $order_id = get_post_meta($earning->ID,'order_id', true);
                                                        $orderobj = wc_get_order($order_id);
                                                        if ($orderobj !== false){
                                                            $status = $orderobj->get_status();
                                                            $earnings_total = get_post_meta($earning->ID,'salesking_commission_total', true);
                                                            // check if approved
                                                            if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                $earnings_number+=$earnings_total;
                                                            }
                                                        }
                                                    }

                                                    // get the total month earnings
                                                    $earnings = get_posts( array( 
                                                        'post_type' => 'salesking_earning',
                                                        'numberposts' => -1,
                                                        'post_status'    => 'any',
                                                        'date_query' => array(
                                                            'year'  => $month_year,
                                                            'month' => $month_number,
                                                        ),
                                                        'meta_key'   => 'parent_agent_id_'.get_current_user_id(),
                                                        'meta_value' => get_current_user_id(),
                                                    ));

                                                    foreach ($earnings as $earning){
                                                        $order_id = get_post_meta($earning->ID,'order_id', true);
                                                        $orderobj = wc_get_order($order_id);
                                                        if ($orderobj !== false){
                                                            $status = $orderobj->get_status();
                                                            $earnings_total = get_post_meta($earning->ID,'parent_agent_id_'.get_current_user_id().'_earnings', true);
                                                            // check if approved
                                                            if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                $earnings_number+=$earnings_total;
                                                            }
                                                        }
                                                    }

                                                    $multicurrency = false;

                                                    if (defined('WOOCS_VERSION')) {
                                                        // base woocs currency
                                                        global $WOOCS;
                                                        echo $WOOCS->default_currency.' '.$earnings_number;
                                                        $multicurrency = true;
                                                    }

                                                    if (defined('WOOMULTI_CURRENCY_F_DIR') || defined('WOOMULTI_CURRENCY_DIR')){

                                                        if (defined('WOOMULTI_CURRENCY_F_DIR')){
                                                            $curcy_settings = WOOMULTI_CURRENCY_F_Data::get_ins();
                                                        } else {
                                                            $curcy_settings = WOOMULTI_CURRENCY_Data::get_ins();
                                                        }

                                                        $default_currency = $curcy_settings->get_default_currency();

                                                        echo $default_currency.' '.$earnings_number;

                                                        $multicurrency = true;
                                                    }

                                                    if (!$multicurrency){
                                                        echo wc_price($earnings_number);
                                                    }

                                                ?></span>
                                            </div>
                                            <div class="drodown">
                                                <a href="#" class="dropdown-toggle btn btn-white btn-dim btn-outline-light" data-toggle="dropdown"><em class="d-none d-sm-inline icon ni ni-calender-date"></em><span><?php
                                                $id = sanitize_text_field(get_query_var('id')); // id is the number of months removed from current month
                                                if (empty($id)){
                                                   $id = 0;
                                                }

                                                echo ucfirst(date_i18n('F Y', strtotime('-'.$id.' months', strtotime(date("F") . "1"))));


                                                ?></span><em class="dd-indc icon ni ni-chevron-right"></em></a>
                                                <div class="dropdown-menu dropdown-menu-right">
                                                    <ul class="link-list-opt no-bdr">
                                                        <?php
                                                        // show all months since user registered
                                                        $udataagent = get_userdata( get_current_user_id() );
                                                        $registered_date = $udataagent->user_registered;
                                                        $time_since_registration = time()-strtotime($registered_date);
                                                        $months_since_registration = ceil($time_since_registration/2678400) + 1;
                                                        $i = 0;
                                                        while ($months_since_registration > 0){

                                                            // show month
                                                            ?>
                                                            <li><a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).'earnings/?id='.$i;?>"><span><?php 
                                                            echo ucfirst(date_i18n('F Y', strtotime('-'.$i.' months', strtotime(date("F") . "1"))));


                                                            ?></span></a></li>
                                                            <?php
                                                            $months_since_registration--;
                                                            $i++;
                                                        }

                                                        ?>
                                                    </ul>
                                                </div>
                                            </div>
                                            

                                        </div>
                                        <div class="nk-sales-ck large pt-3">
                                            <canvas class="sales-overview-chart" id="salesOverview"></canvas>
                                        </div>
                                    </div>
                                </div><!-- .card -->
                            </div><!-- .col -->

                            <div class="col-xxl-12">
                                <div class="nk-block-head nk-block-head-sm">
                                    <div class="nk-block-between">
                                        <div class="nk-block-head-content">
                                            <h3 class="nk-block-title page-title"><?php esc_html_e('Your direct earnings','salesking');?></h3>
                                        </div><!-- .nk-block-head-content -->
                                        <div class="nk-block-head-content">
                                            <div class="toggle-wrap nk-block-tools-toggle">
                                                <a href="#" class="btn btn-icon btn-trigger toggle-expand mr-n1" data-target="more-options"><em class="icon ni ni-more-v"></em></a>
                                                <div class="toggle-expand-content" data-content="more-options">
                                                    <ul class="nk-block-tools g-3">
                                                        <li>
                                                            <div class="form-control-wrap">
                                                                <div class="form-icon form-icon-right">
                                                                    <em class="icon ni ni-search"></em>
                                                                </div>
                                                                <input type="text" class="form-control" id="salesking_earnings_search" placeholder="<?php esc_html_e('Search transactions...','salesking');?>">
                                                            </div>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div><!-- .nk-block-head-content -->
                                    </div><!-- .nk-block-between -->
                                </div><!-- .nk-block-head -->
                                <table id="salesking_dashboard_earnings_table" class="nk-tb-list is-separate mb-3" style="width: 100%; max-width: 100%;">
                                    <thead>
                                        <tr class="nk-tb-item nk-tb-head">
                                            <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Order','salesking'); ?></span></th>
                                            <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Date','salesking'); ?></span></th>
                                            <th class="nk-tb-col"><span class="sub-text d-none d-mb-block"><?php esc_html_e('Earnings Status','salesking'); ?></span></th>
                                            <?php
                                                if (apply_filters('salesking_dashboard_show_customer_column', true)){
                                                ?>
                                                <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Customer','salesking'); ?></span></th>
                                                <?php
                                            }
                                            ?>
                                            <?php do_action('salesking_my_earnings_custom_columns'); ?>
                                            <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Purchased','salesking'); ?></span></th>

                                            <?php
                                                if (apply_filters('salesking_dashboard_earnings_show_total_column', true)){
                                                    ?>
                                                    <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Order Total','salesking'); ?></span></th>
                                                    <?php
                                                }
                                                ?>
                                            <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Your Earnings','salesking'); ?></span></th>
                                            <?php
                                            if (intval(get_option( 'salesking_agents_can_manage_orders_setting', 1 )) === 1){
                                                if (apply_filters('salesking_show_actions_my_earnings_page', true)){

                                                    ?>
                                                    <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Actions','salesking'); ?></span></th>
                                                    <?php
                                                }
                                            }
                                            ?>

                                        </tr>
                                    </thead>
                                    <?php
                                    if (!apply_filters('salesking_load_orders_table_ajax', false)){
                                        ?>
                                        <tfoot>
                                            <tr class="nk-tb-item nk-tb-head">
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('order','salesking'); ?></th>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('date','salesking'); ?></th>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('earnings status','salesking'); ?></th>
                                                <?php
                                                    if (apply_filters('salesking_dashboard_show_customer_column', true)){
                                                    ?>
                                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('customer','salesking'); ?></th>
                                                    <?php
                                                }
                                                ?>
                                                <?php do_action('salesking_my_earnings_custom_columns_footer'); ?>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('purchased','salesking'); ?></th>
                                                <?php
                                                    if (apply_filters('salesking_dashboard_earnings_show_total_column', true)){
                                                        ?>
                                                        <th class="nk-tb-col tb-col-md"><?php esc_html_e('order total','salesking'); ?></th>
                                                        <?php
                                                    }
                                                    ?>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('your earnings','salesking'); ?></th>
                                                <?php
                                                if (intval(get_option( 'salesking_agents_can_manage_orders_setting', 1 )) === 1){
                                                    if (apply_filters('salesking_show_actions_my_earnings_page', true)){

                                                        ?>
                                                        <th class="nk-tb-col tb-col-md"><?php esc_html_e('actions','salesking'); ?></th>
                                                        <?php
                                                    }
                                                }
                                                ?>
                                            </tr>
                                        </tfoot>
                                        <?php
                                    }
                                    ?>
                                    <tbody>
                                        <?php
                                        if (!apply_filters('salesking_load_orders_table_ajax', false)){
                                            $earnings = get_posts( array( 
                                            'post_type' => 'salesking_earning',
                                            'numberposts' => -1,
                                            'post_status'    => 'any',
                                            'fields'    => 'ids',
                                            'meta_key'   => 'agent_id',
                                            'meta_value' => get_current_user_id(),
                                        ));

                                        foreach ($earnings as $earning_id){
                                            $order_id = get_post_meta($earning_id,'order_id', true);
                                            $orderobj = wc_get_order($order_id);
                                            if ($orderobj !== false){
                                                $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
                                                if (!empty($earnings_total) && floatval($earnings_total) !== 0){
                                                    ?>
                                                    <tr class="nk-tb-item">
                                                        <td class="nk-tb-col" data-order="<?php echo esc_html($orderobj->get_order_number());?>">

                                                            <div>
                                                                <span class="tb-lead">#<?php echo esc_html($orderobj->get_order_number());?></span>
                                                            </div>

                                                        </td>

                                                        <td class="nk-tb-col tb-col-md" data-order="<?php 
                                                            $date = explode('T',$orderobj->get_date_created())[0];
                                                            echo strtotime($date);
                                                        ?>">
                                                            <div>
                                                                <span class="tb-sub"><?php 
                                                                echo date_i18n( get_option('date_format'), strtotime($date) ); 

                                                                ?></span>
                                                            </div>
                                                        </td>
                                                        <td class="nk-tb-col"> 
                                                            <div >
                                                                <span class="dot bg-warning d-mb-none"></span>
                                                                <?php
                                                                $status = $orderobj->get_status();
                                                                $statustext = $badge = '';
                                                                if ($status === 'processing'){
                                                                    $badge = 'badge-warning';
                                                                    $statustext = esc_html__('Pending Order Completion','salesking');
                                                                } else if ($status === 'on-hold'){
                                                                    $badge = 'badge-warning';
                                                                    $statustext = esc_html__('Pending Order Completion','salesking');
                                                                } else if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                    $badge = 'badge-success';
                                                                    $statustext = esc_html__('Completed','salesking');
                                                                } else if ($status === 'refunded'){
                                                                    $badge = 'badge-danger';
                                                                    $statustext = esc_html__('Order Refunded','salesking');
                                                                } else if ($status === 'cancelled'){
                                                                    $badge = 'badge-danger';
                                                                    $statustext = esc_html__('Order Cancelled','salesking');
                                                                } else if ($status === 'pending'){
                                                                    $badge = 'badge-warning';
                                                                    $statustext = esc_html__('Pending Order Payment','salesking');
                                                                } else if ($status === 'failed'){
                                                                    $badge = 'badge-danger';
                                                                    $statustext = esc_html__('Order Failed','salesking');
                                                                } else {
                                                                    // custom status
                                                                    $badge = 'badge-gray';
                                                                    $wcstatuses = wc_get_order_statuses();
                                                                    if (isset($wcstatuses['wc-'.$status])){
                                                                        $statustext = $wcstatuses['wc-'.$status];
                                                                    } else {
                                                                        $statustext = '';
                                                                    }
                                                                }

                                                                if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                    $badge = 'badge-success';
                                                                    $statustext = esc_html__('Completed','salesking');
                                                                }

                                                                $badge = apply_filters('salesking_earnings_status_badge', $badge, $orderobj, $status);
                                                                $statustext = apply_filters('salesking_earnings_status_text', $statustext, $orderobj, $status);
                                                                ?>
                                                                <span class="badge badge-sm badge-dot has-bg <?php echo esc_attr($badge);?> d-none d-mb-inline-flex"><?php
                                                                echo esc_html($statustext);
                                                                ?></span>
                                                            </div>
                                                        </td>
                                                        <?php
                                                            if (apply_filters('salesking_dashboard_show_customer_column', true)){
                                                            ?>
                                                            <td class="nk-tb-col tb-col-sm">
                                                                <div>
                                                                     <span class="tb-sub"><?php
                                                                     $customer_id = $orderobj -> get_customer_id();
                                                                     $data = get_userdata($customer_id);
                                                                     $name = $orderobj->get_billing_first_name().' '.$orderobj->get_billing_last_name();

                                                                     $name = apply_filters('salesking_customers_page_name_display', $name, $customer_id);
                                                                     echo $name;
                                                                     ?></span>
                                                                </div>
                                                            </td>
                                                            <?php
                                                        }
                                                        ?>
                                                        <?php do_action('salesking_my_earnings_custom_columns_content', $orderobj); ?>
                                                        <td class="nk-tb-col tb-col-md"> 
                                                            <div>
                                                                <span class="tb-sub text-primary"><?php
                                                                $items = $orderobj->get_items();
                                                                $items_count = count( $items );

                                                                if ($items_count > apply_filters('salesking_dashboard_item_count_limit', 4)){
                                                                    echo $items_count.' '.esc_html__('Items', 'salesking');
                                                                } else {
                                                                    // show the items
                                                                    foreach ($items as $item){
                                                                        echo apply_filters('salesking_item_display_dashboard', $item->get_name().' x '.$item->get_quantity().'<br>', $item);
                                                                    }
                                                                }
                                                                ?></span>
                                                            </div>
                                                        </td>
                                                        <?php
                                                            if (apply_filters('salesking_dashboard_earnings_show_total_column', true)){
                                                                ?>
                                                                <td class="nk-tb-col tb-col-sm" data-order="<?php echo esc_attr(apply_filters('salesking_earnings_order_total', $orderobj->get_total(), $orderobj));?>"> 
                                                                    <div>
                                                                        <span class="tb-lead"><?php echo wc_price(apply_filters('salesking_earnings_order_total', $orderobj->get_total(), $orderobj), array('currency' => $orderobj->get_currency()));?></span>
                                                                    </div>
                                                                </td>
                                                                <?php
                                                            }
                                                            ?>
                                                        <td class="nk-tb-col" data-order="<?php echo esc_attr($earnings_total);?>"> 
                                                            <div>
                                                                <?php
                                                                ob_start();
                                                                if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                    $text_color = 'text-success';
                                                                } else {
                                                                    $text_color = 'text-soft';
                                                                }
                                                                ?>
                                                                <span class="tb-lead <?php echo esc_attr($text_color);?>"><?php 
                                                                
                                                                $multicurrency = false;

                                                                if (defined('WOOCS_VERSION')) {
                                                                    // base woocs currency
                                                                    global $WOOCS;
                                                                    echo $WOOCS->default_currency.' '.$earnings_total;
                                                                    $multicurrency = true;
                                                                }

                                                                if (defined('WOOMULTI_CURRENCY_F_DIR') || defined('WOOMULTI_CURRENCY_DIR')){

                                                                    if (defined('WOOMULTI_CURRENCY_F_DIR')){
                                                                        $curcy_settings = WOOMULTI_CURRENCY_F_Data::get_ins();
                                                                    } else {
                                                                        $curcy_settings = WOOMULTI_CURRENCY_Data::get_ins();
                                                                    }

                                                                    $default_currency = $curcy_settings->get_default_currency();

                                                                    echo $default_currency.' '.$earnings_total;

                                                                    $multicurrency = true;
                                                                }

                                                                if (!$multicurrency){
                                                                    echo wc_price($earnings_total);
                                                                }

                                                                if (!in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                    esc_html_e(' (pending)', 'salesking');
                                                                }

                                                                $content = ob_get_clean();

                                                                echo apply_filters('salesking_your_earnings_content', $content, $orderobj, $earning_id, $earnings_total);


                                                                ?></span>
                                                            </div>
                                                        </td>
                                                        <?php

                                                        if (intval(get_option( 'salesking_agents_can_manage_orders_setting', 1 )) === 1){
                                                            if (apply_filters('salesking_show_actions_my_earnings_page', true)){

                                                                ?>
                                                                <td class="nk-tb-col">
                                                                    <div class="salesking_manage_order_container"> 
                                                                        <?php
                                                                        // Check if frontend order management is enabled
                                                                        if (apply_filters('salesking_use_frontend_order_management', false)) {
                                                                            // Use frontend manage-order page
                                                                            $manage_url = trailingslashit(get_page_link(get_option( 'salesking_agents_page_setting', 'disabled' ))).'manage-order/'.$order_id;
                                                                        } else {
                                                                            // Use default WP admin URL
                                                                            $manage_url = $orderobj->get_edit_order_url();
                                                                        }
                                                                        ?>
                                                                        <a href="<?php echo esc_attr($manage_url);?>"><button class="btn btn-sm btn-primary salesking_manage_order" value="<?php echo esc_attr($order_id);?>"><em class="icon ni ni-bag-fill"></em><span><?php esc_html_e('Manage Order','salesking');?></span></button></a>
                                                                    </div>
                                                                </td>
                                                                <?php
                                                            }
                                                        }
                                                        ?>
                                                    </tr>
                                                <?php
                                                }
                                            }
                                            // display manual adjustments
                                            if ($order_id == 'manual'){

                                                $earnings_total = get_post_meta($earning_id,'salesking_commission_total', true);
                                                if (!empty($earnings_total) && floatval($earnings_total) !== 0){
                                                    ?>
                                                    <tr class="nk-tb-item">
                                                        <td class="nk-tb-col" data-order="<?php echo esc_html($order_id);?>">

                                                            <div>
                                                                <span class="tb-lead"><?php 

                                                                esc_html_e('Manual Adjustment','salesking');

                                                                ?></span>
                                                            </div>

                                                        </td>
                                                        <td class="nk-tb-col tb-col-md" data-order="<?php 
                                                            $date = get_post_meta($earning_id,'time', true);
                                                            echo $date;

                                                        ?>">
                                                            <div>
                                                                <span class="tb-sub"><?php 
                                                                echo date_i18n( get_option('date_format'), $date+(get_option('gmt_offset')*3600) );
                                                                ?></span>
                                                            </div>
                                                        </td>
                                                        <td class="nk-tb-col"> 
                                                            <div >
                                                                <span class="dot bg-warning d-mb-none"></span>
                                                                <?php
                                                                $note = get_post_meta($earning_id,'note', true);
                                                                if (empty($note)){
                                                                    echo '-';
                                                                } else {
                                                                    echo $note;
                                                                }
                                                                ?>
                                                            </div>
                                                        </td>
                                                        <td class="nk-tb-col tb-col-sm">
                                                            <div>
                                                                 <span class="tb-sub"><?php
                                                                 echo '-';
                                                                 ?></span>
                                                            </div>
                                                        </td>
                                                        <td class="nk-tb-col tb-col-md"> 
                                                            <div>
                                                                <span class="tb-sub text-primary"><?php
                                                                echo '-';
                                                                ?></span>
                                                            </div>
                                                        </td>
                                                        <td class="nk-tb-col tb-col-sm"> 
                                                            <div>
                                                                <span class="tb-lead"><?php echo '-';?></span>
                                                            </div>
                                                        </td>
                                                        <td class="nk-tb-col" data-order="<?php echo esc_attr($earnings_total);?>"> 
                                                            <div>
                                                                <?php
                                                                echo wc_price($earnings_total);
                                                                
                                                                ?>
                                                            </div>
                                                        </td>
                                                        <td class="nk-tb-col tb-col-md"> 
                                                            <div>
                                                                <span class="tb-sub text-primary"><?php
                                                                echo '-';
                                                                ?></span>
                                                            </div>
                                                        </td>
                                                        
                                                    </tr>
                                                <?php
                                                }
                                            }
                                        }
                                        }
                                        ?>
                                        
                                    </tbody>
                                    
                                </table>
                            </div>
                            <?php
                            if (intval(get_option( 'salesking_enable_teams_setting', 1 )) === 1){
                                ?>
                                <div class="col-xxl-12">
                                    <div class="nk-block-head nk-block-head-sm">
                                        <div class="nk-block-between">
                                            <div class="nk-block-head-content">
                                                <h3 class="nk-block-title page-title"><?php esc_html_e('Earnings from your subagents','salesking');?></h3>
                                            </div><!-- .nk-block-head-content -->
                                            <div class="nk-block-head-content">
                                                <div class="toggle-wrap nk-block-tools-toggle">
                                                    <a href="#" class="btn btn-icon btn-trigger toggle-expand mr-n1" data-target="more-options"><em class="icon ni ni-more-v"></em></a>
                                                    <div class="toggle-expand-content" data-content="more-options">
                                                        <ul class="nk-block-tools g-3">
                                                            <li>
                                                                <div class="form-control-wrap">
                                                                    <div class="form-icon form-icon-right">
                                                                        <em class="icon ni ni-search"></em>
                                                                    </div>
                                                                    <input type="text" class="form-control" id="salesking_subagents_earnings_search" placeholder="<?php esc_html_e('Search transactions...','salesking');?>">
                                                                </div>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div><!-- .nk-block-head-content -->
                                        </div><!-- .nk-block-between -->
                                    </div><!-- .nk-block-head -->
                                    <table id="salesking_dashboard_subagents_earnings_table" class="nk-tb-list is-separate mb-3">
                                        <thead>
                                            <tr class="nk-tb-item nk-tb-head">
                                                <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Order','salesking'); ?></span></th>
                                                <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Date','salesking'); ?></span></th>
                                                <th class="nk-tb-col"><span class="sub-text d-none d-mb-block"><?php esc_html_e('Earnings Status','salesking'); ?></span></th>
                                                <?php
                                                if (apply_filters('salesking_show_subagent_customer_details', false)){
                                                    ?>
                                                    <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Customer','salesking'); ?></span></th>
                                                    <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Purchased','salesking'); ?></span></th>
                                                    <?php
                                                }
                                                ?>
                                                <th class="nk-tb-col"><span class="sub-text d-none d-mb-block"><?php esc_html_e('Subagent','salesking'); ?></span></th>
                                                <?php
                                                if (apply_filters('salesking_dashboard_earnings_show_total_column', true)){
                                                    ?>
                                                    <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Order Total','salesking'); ?></span></th>
                                                    <?php
                                                }
                                                ?>
                                                <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Your Earnings','salesking'); ?></span></th>
         

                                            </tr>
                                        </thead>
                                        <tfoot>
                                            <tr class="nk-tb-item nk-tb-head">
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('order','salesking'); ?></th>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('date','salesking'); ?></th>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('earnings status','salesking'); ?></th>
                                                <?php
                                                if (apply_filters('salesking_show_subagent_customer_details', false)){
                                                    ?>
                                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('customer','salesking'); ?></th>
                                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('purchased','salesking'); ?></th>
                                                    <?php
                                                }
                                                ?>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('subagent','salesking'); ?></th>
                                                <?php
                                                if (apply_filters('salesking_dashboard_earnings_show_total_column', true)){
                                                    ?>
                                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('order total','salesking'); ?></th>
                                                    <?php
                                                }
                                                ?>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('your earnings','salesking'); ?></th>
                                               
                                            </tr>
                                        </tfoot>
                                     
                                        <tbody>
                                            <?php
                                            $earnings = get_posts( array( 
                                                'post_type' => 'salesking_earning',
                                                'numberposts' => -1,
                                                'post_status'    => 'any',
                                                'fields'    => 'ids',
                                                'meta_key'   => 'parent_agent_id_'.get_current_user_id(),
                                                'meta_value' => get_current_user_id(),
                                            ));

                                            foreach ($earnings as $earning_id){
                                                $order_id = get_post_meta($earning_id,'order_id', true);
                                                $orderobj = wc_get_order($order_id);
                                                if ($orderobj !== false){
                                                    $earnings_total = get_post_meta($earning_id,'parent_agent_id_'.get_current_user_id().'_earnings', true);
                                                    if (!empty($earnings_total) && floatval($earnings_total) !== 0){
                                                        ?>
                                                        <tr class="nk-tb-item">
                                                            <td class="nk-tb-col">

                                                                <div>
                                                                    <span class="tb-lead">#<?php echo esc_html($orderobj->get_order_number());?></span>
                                                                </div>

                                                            </td>
                                                            <td class="nk-tb-col tb-col-md" data-order="<?php 
                                                                $date = explode('T',$orderobj->get_date_created())[0];
                                                                echo apply_filters('salesking_dashboard_date_display',strtotime($date), $orderobj->get_date_created());
                                                            ?>">
                                                                <div>
                                                                    <span class="tb-sub"><?php 
                                                                    echo date_i18n( get_option('date_format'), strtotime($date) ); 

                                                                    ?></span>
                                                                </div>
                                                            </td>
                                                            <td class="nk-tb-col"> 
                                                                <div >
                                                                    <span class="dot bg-warning d-mb-none"></span>
                                                                    <?php
                                                                    $status = $orderobj->get_status();
                                                                    $statustext = $badge = '';
                                                                    if ($status === 'processing'){
                                                                        $badge = 'badge-warning';
                                                                        $statustext = esc_html__('Pending Order Completion','salesking');
                                                                    } else if ($status === 'on-hold'){
                                                                        $badge = 'badge-warning';
                                                                        $statustext = esc_html__('Pending Order Completion','salesking');
                                                                    } else if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                        $badge = 'badge-success';
                                                                        $statustext = esc_html__('Completed','salesking');
                                                                    } else if ($status === 'refunded'){
                                                                        $badge = 'badge-danger';
                                                                        $statustext = esc_html__('Order Refunded','salesking');
                                                                    } else if ($status === 'cancelled'){
                                                                        $badge = 'badge-danger';
                                                                        $statustext = esc_html__('Order Cancelled','salesking');
                                                                    } else if ($status === 'pending'){
                                                                        $badge = 'badge-warning';
                                                                        $statustext = esc_html__('Pending Order Payment','salesking');
                                                                    } else if ($status === 'failed'){
                                                                        $badge = 'badge-danger';
                                                                        $statustext = esc_html__('Order Failed','salesking');
                                                                    } else {
                                                                        // custom status
                                                                        $badge = 'badge-gray';
                                                                        $wcstatuses = wc_get_order_statuses();
                                                                        if (isset($wcstatuses['wc-'.$status])){
                                                                            $statustext = $wcstatuses['wc-'.$status];
                                                                        } else {
                                                                            $statustext = '';
                                                                        }
                                                                    }

                                                                    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                        $badge = 'badge-success';
                                                                        $statustext = esc_html__('Completed','salesking');
                                                                    }

                                                                        ?>
                                                                    <span class="badge badge-sm badge-dot has-bg <?php echo esc_attr($badge);?> d-none d-mb-inline-flex"><?php
                                                                    echo esc_html($statustext);
                                                                    ?></span>
                                                                </div>
                                                            </td>
                                                            <?php
                                                            if (apply_filters('salesking_show_subagent_customer_details', false)){
                                                                ?>
                                                                 <td class="nk-tb-col tb-col-sm">
                                                                    <div>
                                                                         <span class="tb-sub"><?php
                                                                         $customer_id = $orderobj -> get_customer_id();
                                                                         $data = get_userdata($customer_id);
                                                                         $name = $orderobj->get_billing_first_name().' '.$orderobj->get_billing_last_name();

                                                                         $name = apply_filters('salesking_customers_page_name_display', $name, $customer_id);
                                                                         echo $name;
                                                                         ?></span>
                                                                    </div>
                                                                </td>
                                                                <td class="nk-tb-col tb-col-md"> 
                                                                    <div>
                                                                        <span class="tb-sub text-primary"><?php
                                                                        $items = $orderobj->get_items();
                                                                        $items_count = count( $items );

                                                                        if ($items_count > apply_filters('salesking_dashboard_item_count_limit', 4)){
                                                                            echo $items_count.' '.esc_html__('Items', 'salesking');
                                                                        } else {
                                                                            // show the items
                                                                            foreach ($items as $item){
                                                                                echo apply_filters('salesking_item_display_dashboard', $item->get_name().' x '.$item->get_quantity().'<br>', $item);
                                                                            }
                                                                        }
                                                                        ?></span>
                                                                    </div>
                                                                </td>
                                                                <?php
                                                            }
                                                            ?>

                                                            <?php
                                                            // get subagent name
                                                            $subagent_id = get_post_meta($earning_id, 'agent_id', true);
                                                            $datat = get_userdata($subagent_id);
                                                            if ($datat){
                                                                $named = $datat->first_name.' '.$datat->last_name;
                                                            } else {
                                                                $named = '';
                                                            }

                                                            ?>
                                                            <td class="nk-tb-col" > 
                                                                <div>
                                                                    <span class="tb-lead"><?php echo esc_html($named);?></span>
                                                                </div>
                                                            </td>
                                                            <?php
                                                            if (apply_filters('salesking_dashboard_earnings_show_total_column', true)){
                                                                ?>
                                                                <td class="nk-tb-col tb-col-sm" data-order="<?php echo esc_attr(apply_filters('salesking_earnings_order_total',$orderobj->get_total(), $orderobj));?>"> 
                                                                    <div>
                                                                        
                                                                        <span class="tb-lead"><?php echo wc_price(apply_filters('salesking_earnings_order_total',$orderobj->get_total(), $orderobj), array('currency' => $orderobj->get_currency()));?></span>
                                                                    </div>
                                                                </td>
                                                                <?php
                                                            }
                                                            ?>
                                                            <td class="nk-tb-col" data-order="<?php echo esc_attr($earnings_total);?>"> 
                                                                <div>
                                                                    <?php
                                                                    if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                        $text_color = 'text-success';
                                                                    } else {
                                                                        $text_color = 'text-soft';
                                                                    }
                                                                    ?>
                                                                    <span class="tb-lead <?php echo esc_attr($text_color);?>"><?php 
                                                                    
                                                                    $multicurrency = false;

                                                                    if (defined('WOOCS_VERSION')) {
                                                                        // base woocs currency
                                                                        global $WOOCS;
                                                                        echo $WOOCS->default_currency.' '.$earnings_total;
                                                                        $multicurrency = true;
                                                                    }

                                                                    if (defined('WOOMULTI_CURRENCY_F_DIR') || defined('WOOMULTI_CURRENCY_DIR')){

                                                                        if (defined('WOOMULTI_CURRENCY_F_DIR')){
                                                                            $curcy_settings = WOOMULTI_CURRENCY_F_Data::get_ins();
                                                                        } else {
                                                                            $curcy_settings = WOOMULTI_CURRENCY_Data::get_ins();
                                                                        }

                                                                        $default_currency = $curcy_settings->get_default_currency();

                                                                        echo $default_currency.' '.$earnings_total;

                                                                        $multicurrency = true;
                                                                    }

                                                                    if (!$multicurrency){
                                                                        echo wc_price($earnings_total);
                                                                    }

                                                                    if (!in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                                        esc_html_e(' (pending)', 'salesking');
                                                                    }
                                                                    ?></span>
                                                                </div>
                                                            </td>
                                                            
                                                        </tr>
                                                    <?php
                                                    }
                                                }
                                            }


                                            ?>
                                            
                                        </tbody>
                                        
                                    </table>
                                </div>
                                <?php
                            }
                            ?>
                        </div><!-- .row -->
                    </div><!-- .nk-block -->
                </div>
            </div>
        </div>
    </div>
    <?php
}
?>