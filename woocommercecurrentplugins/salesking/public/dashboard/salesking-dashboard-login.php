<?php 

defined( 'ABSPATH' ) || exit; 

?>
<html>
    <head>
        <base href="../../">
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <?php
        // favicon url
        $favicon_setting = get_option('salesking_logo_favicon_setting','');
        if (empty($favicon_setting)){
            $favicon_setting = plugins_url('../../includes/assets/images/salesking-icon2.svg', __FILE__);
        }

        ?>
        <link rel="shortcut icon" href="<?php echo apply_filters('salesking_favicon_url', $favicon_setting);?>"/>

        <title><?php echo apply_filters('salesking_dashboard_page_name', esc_html__('Agent Dashboard','salesking'));?></title>
        <?php
        global $salesking_public;

        add_action('wp_print_styles', array($salesking_public, 'enqueue_dashboard_resources'));
        add_action('wp_print_scripts', array($salesking_public, 'enqueue_dashboard_resources'));

        add_action('wp_print_styles', function(){
            global $wp_styles;
            $wp_styles->queue = array('salesking_dashboard', 'jquerymodalzz', 'b2bkingintegrationsk', 'select2');
        });
        add_action('wp_print_scripts', function(){

            global $wp_scripts;
            $wp_scripts->queue = array('salesking_dashboard_bundle','salesking_dashboard_scripts','salesking_dashboard_chart','salesking_public_script', 'salesking_dashboard_messages', 'salesking_dashboard_chart_sales', 'dataTablesButtons', 'jszip', 'pdfmake', 'dataTablesButtonsHTML', 'dataTablesButtonsPrint', 'dataTablesButtonsColvis', 'vfsfonts', 'jquerymodalzz', 'select2', 'wc-country-select', 'wc-address-i18n');
        });

        wp_print_styles(); 
        
        wp_print_scripts(); 


        if (intval(get_option('salesking_change_color_scheme_setting', 0)) === 1){
            // Load colors
            $color = get_option( 'salesking_main_dashboard_color_setting', '#854fff' );
            $colorhover = get_option( 'salesking_main_dashboard_hover_color_setting', '#6a29ff' );

            ?>

            <style type="text/css">
                .user-avatar, [class^="user-avatar"]:not([class*="-group"]),.datepicker table tr td.today:hover, .datepicker table tr td.today:hover:hover, .datepicker table tr td.today.disabled:hover, .datepicker table tr td.today.disabled:hover:hover, .datepicker table tr td.today:active, .datepicker table tr td.today:hover:active, .datepicker table tr td.today.disabled:active, .datepicker table tr td.today.disabled:hover:active, .datepicker table tr td.today.active, .datepicker table tr td.today:hover.active, .datepicker table tr td.today.disabled.active, .datepicker table tr td.today.disabled:hover.active, .datepicker table tr td.today.disabled, .datepicker table tr td.today:hover.disabled, .datepicker table tr td.today.disabled.disabled, .datepicker table tr td.today.disabled:hover.disabled, .datepicker table tr td.today[disabled], .datepicker table tr td.today:hover[disabled], .datepicker table tr td.today.disabled[disabled], .datepicker table tr td.today.disabled:hover[disabled],.datepicker table tr td.range.today:hover, .datepicker table tr td.range.today:hover:hover, .datepicker table tr td.range.today.disabled:hover, .datepicker table tr td.range.today.disabled:hover:hover, .datepicker table tr td.range.today:active, .datepicker table tr td.range.today:hover:active, .datepicker table tr td.range.today.disabled:active, .datepicker table tr td.range.today.disabled:hover:active, .datepicker table tr td.range.today.active, .datepicker table tr td.range.today:hover.active, .datepicker table tr td.range.today.disabled.active, .datepicker table tr td.range.today.disabled:hover.active, .datepicker table tr td.range.today.disabled, .datepicker table tr td.range.today:hover.disabled, .datepicker table tr td.range.today.disabled.disabled, .datepicker table tr td.range.today.disabled:hover.disabled, .datepicker table tr td.range.today[disabled], .datepicker table tr td.range.today:hover[disabled], .datepicker table tr td.range.today.disabled[disabled], .datepicker table tr td.range.today.disabled:hover[disabled],.datepicker table tr td.active, .datepicker table tr td.active:hover, .datepicker table tr td.active.disabled, .datepicker table tr td.active.disabled:hover,.datepicker table tr td span.active, .datepicker table tr td span.active:hover, .datepicker table tr td span.active.disabled, .datepicker table tr td span.active.disabled:hover, .user-avatar, [class^="user-avatar"]:not([class*="-group"]), .btn-primary, .nav-tabs .nav-link:after, .custom-control-input:checked ~ .custom-control-label::before, .custom-control-input:not(:disabled):active ~ .custom-control-label::before, .salesking_available_payout_card, .badge-primary, .nk-msg-menu-item a:after, .user-avatar, [class^="user-avatar"]:not([class*="-group"]), .page-item.active .page-link{
                    background: <?php echo esc_html( $color ); ?> ;

                }

                .card.is-dark{
                    background: <?php echo esc_html( $color ); ?>;
                    filter: grayscale(0.4);
                }

                .btn-primary, .form-control:focus, .dual-listbox .dual-listbox__search:focus, .custom-control-input:checked ~ .custom-control-label::before, .custom-control-input:not(:disabled):active ~ .custom-control-label::before, .badge-primary, .badge-primary, .page-item.active .page-link{
                    border-color: <?php echo esc_html( $color ); ?>;
                }

                a, .link-list a:hover, .is-light .nk-menu-link:hover, .is-light .active > .nk-menu-link, .nk-menu-link:hover .nk-menu-icon, .nk-menu-item.active > .nk-menu-link .nk-menu-icon, .nk-menu-item.current-menu > .nk-menu-link .nk-menu-icon, .user-balance, .link-list-menu li.active > a, .link-list-menu a.active, .link-list-menu a:hover, .link-list-menu li.active > a .icon, .link-list-menu a.active .icon, .link-list-menu a:hover .icon, .link-list-menu li.active > a:after, .link-list-menu a.active:after, .link-list-menu a:hover:after, .nav-tabs .nav-link.active, .nk-msg-menu-item.active a, .nk-msg-menu-item a:hover, .nk-menu-badge, .icon-avatar, .user-avatar[class*="-purple-dim"], .page-link:hover,.link-list-opt a:hover{ 
                    color: <?php echo esc_html( $color ); ?>;
                }

                .bg-primary, .page-item.active .page-link{
                    background: <?php echo esc_html( $color ); ?>!important;
                }

                #salesking_dashboard_customers_table .bg-primary, #salesking_dashboard_offers_table .bg-primary {
                    background-color: <?php echo esc_html( $color ); ?>!important;
                }

                .link-primary, .text-primary{
                    color: <?php echo esc_html( $color ); ?>!important;
                }

                a:hover {
                    color: <?php echo esc_html( $colorhover ); ?>;
                }

                .icon-avatar, .nk-menu-badge, .user-avatar[class*="-purple-dim"]{
                    background: #ebebeb;
                }

                .btn-primary:hover, .btn-primary:not(:disabled):not(.disabled):active, .btn-primary:not(:disabled):not(.disabled).active, .show > .btn-primary.dropdown-toggle, .btn-primary:focus, .btn-primary.focus, .salesking_available_payout_header {
                    background-color: <?php echo esc_html( $colorhover ); ?>;
                }

                .btn-primary:hover, .btn-primary:not(:disabled):not(.disabled):active, .btn-primary:not(:disabled):not(.disabled).active, .show > .btn-primary.dropdown-toggle, .btn-primary:focus, .btn-primary.focus{
                    border-color: <?php echo esc_html( $colorhover ); ?>;
                }

                .btn-primary:not(:disabled):not(.disabled):active:focus, .btn-primary:not(:disabled):not(.disabled).active:focus, .show > .btn-primary.dropdown-toggle:focus, .btn-primary:focus, .btn-primary.focus{
                    box-shadow: 0 0 0 0.2rem <?php echo esc_html($colorhover); ?> ;
                }

            </style>
            <?php
        }

        do_action('salesking_dashboard_head');

        ?>
    </head>
    <?php
    // check if switch cookie is set
    $switch_to = '';
    if (isset($_COOKIE['salesking_switch_cookie'])){
        $switch_to = sanitize_text_field($_COOKIE['salesking_switch_cookie']);
    }
    
    $current_id = get_current_user_id();

    if (!empty($switch_to) && is_user_logged_in()){
        // show bar
        $udata = get_userdata( get_current_user_id() );
        $name = $udata->first_name.' '.$udata->last_name;

        // get agent details
        $agent = explode('_',$switch_to);
        $customer_id = intval($agent[0]);
        $agent_id = intval($agent[1]);
        $agent_registration = $agent[2];
        // check real registration in database
        $udataagent = get_userdata( $agent_id );
        $registered_date = $udataagent->user_registered;

        // if current logged in user is the one in the cookie + agent cookie checks out
        if ($current_id === $customer_id && $agent_registration === $registered_date){
        ?>
        <div id="salesking_agent_switched_bar">
            <div class="salesking_bar_element">
                <?php 

                esc_html_e('You are shopping as ','salesking');
                echo '<strong>'.esc_html($name).' ('.$udata->user_login.')'.'</strong>';

                ?>  
            </div>  
            <div class="salesking_bar_element">
                <button id="salesking_return_agent" value="<?php echo esc_attr($agent_id);?>"><em class="salesking_ni salesking_ni-swap"></em>&nbsp;&nbsp;&nbsp;<span><?php esc_html_e('Switch to Agent', 'salesking'); ?></span></button>
                <input type="hidden" id="salesking_return_agent_registered" value="<?php echo esc_attr($agent_registration);?>">
            </div>      
        </div>
        <?php
        }
    }
    ?>
    <?php

    // get logo
    $logo_src = get_option('salesking_logo_setting','');
    // if no logo configured, set default salesking logo
    if ($logo_src === ''){
        $logo_src = plugins_url('../../includes/assets/images/saleskinglogoblack2.png', __FILE__);
    }

    // User is logged in, but not a sales agent -> show logout button

    if ( is_user_logged_in() ) {
        // check if user is sales agent
        $is_sales_agent = get_user_meta(get_current_user_id(),'salesking_group', true);
        if ($is_sales_agent === 'none' || empty($is_sales_agent)){
            do_action('marketking_before_not_sales_agent_dashboard');
            ?>
                <body class="nk-body npc-default pg-auth no-touch nk-nio-theme">

                    <div class="nk-app-root">
                        <!-- main @s -->
                        <div class="nk-main ">
                            <!-- wrap @s -->
                            <div class="nk-wrap nk-wrap-nosidebar">
                                <!-- content @s -->
                                <div class="nk-content ">
                                    <div class="nk-block nk-block-middle nk-auth-body  wide-xs">
                                        <div class="brand-logo pb-4 text-center brand-logo-padding">
                                            <a href="<?php echo esc_attr(get_home_url());?>"><img class="logo-dark logo-img logo-img-lg" src="<?php echo esc_url($logo_src); ?>" alt="logo-dark"></a>
                                        </div>
                                        <div class="card">
                                            <div class="card-inner card-inner-lg">
                                                    <div class="example-alert">
                                                        <div class="alert alert-danger alert-icon alert-dismissible">
                                                            <em class="icon ni ni-cross-circle"></em> <strong><?php esc_html_e('Invalid Account','salesking');?></strong>! <?php         echo '<span class="salesking_already_logged_in_message">';
                esc_html_e('Your current account is not a sales agent. To login as a sales agent, please logout first. ','salesking');

                                                            ?> <button class="close" data-dismiss="alert"></button></div>
                                                    </div><br />
                                                <a href="<?php echo esc_url(wc_logout_url()); ?>">
                                                    <button id="wp-submit" type="submit" value="Login" name="wp-submit" class="btn btn-lg btn-primary btn-block"><?php esc_html_e('Log out','salesking');?></button>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <!-- wrap @e -->
                            </div>
                            <!-- content @e -->
                        </div>
                        <!-- main @e -->
                    </div>


                </body>

            <?php

        } else {

            // User is logged in, and a sales agent -> Show dashboard

            include('salesking-dashboard.php');

        }

    } else {
        
            // User is not logged in -> Show login page

            ?>
            <body class="nk-body npc-default pg-auth no-touch nk-nio-theme">

            <div class="nk-app-root">
                <!-- main @s -->
                <div class="nk-main ">
                    <!-- wrap @s -->
                    <div class="nk-wrap nk-wrap-nosidebar">
                        <!-- content @s -->
                        <div class="nk-content ">
                            <div class="nk-block nk-block-middle nk-auth-body  wide-xs">
                                <div class="brand-logo pb-4 text-center brand-logo-padding">
                                    <a href="<?php echo esc_attr(get_home_url());?>"><img class="logo-dark logo-img logo-img-lg" src="<?php echo esc_url($logo_src); ?>" alt="logo-dark"></a>
                                </div>
                                <div class="card">
                                    <div class="card-inner card-inner-lg">
                                        <?php 
                                        if (isset($_GET['reason'])){
                                            $reason = sanitize_text_field($_GET['reason']);
                                            if ($reason === 'invalid_username'){
                                                $reason = esc_html__('Username is invalid','salesking');
                                            }
                                            if ($reason === 'empty_username'){
                                                $reason = esc_html__('Username is empty','salesking');
                                            }
                                            if ($reason === 'incorrect_password'){
                                                $reason = esc_html__('Password is incorrect','salesking');
                                            }
                                            if ($reason === 'empty_password'){
                                                $reason = esc_html__('Password is empty','salesking');
                                            }

                                            ?>                                        
                                            <div class="example-alert">
                                                <div class="alert alert-danger alert-icon alert-dismissible">
                                                    <em class="icon ni ni-cross-circle"></em> <strong><?php esc_html_e('Login failed','salesking');?></strong>! <?php echo $reason;?> <button class="close" data-dismiss="alert"></button></div>
                                            </div><br />
                                            <?php
                                        }
                                        ?>
                                        <div class="nk-block-head">
                                            <div class="nk-block-head-content">
                                                <h4 class="nk-block-title"><?php esc_html_e('Sign-In','salesking');?></h4>
                                                <div class="nk-block-des">
                                                    <p><?php esc_html_e('Access your sales agent dashboard and data.','salesking');?></p>
                                                </div>
                                            </div>
                                        </div>

                                        <form name="loginform" id="loginform" action="<?php echo site_url( '/wp-login.php' ); ?>" method="post">
                                            <div class="form-group">
                                                <div class="form-label-group">
                                                    <label class="form-label" for="default-01"><?php esc_html_e('Email or Username','salesking');?></label>
                                                </div>
                                                <input type="text" class="form-control form-control-lg" id="user_login" placeholder="<?php esc_attr_e('Enter your email address or username','salesking');?>" name="log">
                                            </div>
                                            <div class="form-group">
                                                <div class="form-label-group">
                                                    <label class="form-label" for="password"><?php esc_html_e('Password','salesking');?></label>
                                                    <a class="link link-primary link-sm" href="<?php echo wp_lostpassword_url(); ?>"><?php esc_html_e('Forgot password?','salesking');?></a>
                                                </div>
                                                <div class="form-control-wrap">
                                                    <a href="#" class="form-icon form-icon-right passcode-switch" data-target="user_pass">
                                                        <em class="passcode-icon icon-show icon ni ni-eye"></em>
                                                        <em class="passcode-icon icon-hide icon ni ni-eye-off"></em>
                                                    </a>
                                                    <input type="password" class="form-control form-control-lg" id="user_pass" placeholder="<?php esc_attr_e('Enter your password','salesking');?>" name="pwd">
                                                    <input type="hidden" name="salesking_dashboard_login" value="1">
                                                    <input type="hidden" value="<?php echo esc_attr( trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))) ); ?>" name="redirect_to">
                                                </div>
                                            </div>
                                            <div class="form-group">
                                                <button id="wp-submit" type="submit" value="Login" name="wp-submit" class="btn btn-lg btn-primary btn-block"><?php esc_html_e('Sign in','salesking');?></button>
                                            </div>

                                        </form>
                                        <div class="form-note-s2 text-center pt-4"> <?php esc_html_e('New on our platform?','salesking');?> <a href="<?php echo apply_filters('salesking_create_account_dashboard_link', esc_attr(get_permalink( wc_get_page_id( 'myaccount' ) ) .'?redir=1') ); ?>"><?php esc_html_e('Create an account','salesking');?></a>
                                        </div>
                                        
                                    </div>
                                    <?php

                                    do_action('salesking_after_login');

                                    ?>
                                    <div id="salesking_footer_hidden">
                                        <?php
                                        if (apply_filters('salesking_display_footer_scripts', false)){
                                            wp_footer();
                                        }
                                        ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- wrap @e -->
                    </div>
                    <!-- content @e -->
                </div>
                <!-- main @e -->
            </div>


        </body>

    <?php
    }
    ?>
</html>
    