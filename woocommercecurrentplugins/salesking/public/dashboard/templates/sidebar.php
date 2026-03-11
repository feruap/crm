<div class="nk-sidebar nk-sidebar-fixed is-light " data-content="sidebarMenu">
    <div class="nk-sidebar-element nk-sidebar-head">
        <div class="nk-sidebar-brand">
            <a href="<?php echo esc_attr(get_home_url());?>" class="logo-link nk-sidebar-logo">
                <img class="logo-small logo-img logo-img-small" src="<?php echo esc_url($logo_src); ?>" alt="logo-small">
            </a>
        </div>
        <div class="nk-menu-trigger mr-n2">
            <a href="#" class="nk-nav-toggle nk-quick-nav-icon d-xl-none" data-target="sidebarMenu"><em class="icon ni ni-arrow-left"></em></a>
            <a href="#" class="nk-nav-compact nk-quick-nav-icon d-none" data-target="sidebarMenu"><em class="icon ni ni-menu"></em></a>
        </div>
    </div><!-- .nk-sidebar-element -->
    <div class="nk-sidebar-element">
        <div class="nk-sidebar-content">
            <div class="nk-sidebar-menu" data-simplebar>
                <ul class="nk-menu">
                    <?php
                    if (intval(get_option( 'salesking_enable_announcements_setting', 1 )) === 1){
                        ?>
                        <li class="nk-menu-item">
                            <a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).'announcements';?>" class="nk-menu-link">
                                <span class="nk-menu-icon"><em class="icon ni ni-bell"></em></span>
                                <span class="nk-menu-text"><?php esc_html_e('Announcements', 'salesking');?></span>
                                <?php if ($unread_ann !== 0){ ?>
                                    <span class="nk-menu-badge badge-danger"><?php echo esc_html($unread_ann).esc_html__(' New', 'salesking');?></span>
                                <?php } ?>
                            </a>
                        </li><!-- .nk-menu-item -->
                        <?php
                    } else {
                        // show for correct menu
                        ?>
                        <li class="nk-menu-item salesking_menu_hidden_item">
                            <a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).'announcements';?>" class="nk-menu-link">
                                <span class="nk-menu-icon"><em class="icon ni ni-bell"></em></span>
                                <span class="nk-menu-text"><?php esc_html_e('Announcements', 'salesking');?></span>
                                <?php if ($unread_ann !== 0){ ?>
                                    <span class="nk-menu-badge badge-danger"><?php echo esc_html($unread_ann).esc_html__(' New', 'salesking');?></span>
                                <?php } ?>
                            </a>
                        </li><!-- .nk-menu-item -->
                        <?php

                    }
                    ?>
                    <li class="nk-menu-heading">
                    </li><!-- .nk-menu-item -->
                    <li class="nk-menu-item">
                       <a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true))));?>" class="nk-menu-link">
                           <span class="nk-menu-icon"><em class="icon ni ni-dashboard-fill"></em></span>
                           <span class="nk-menu-text"><?php esc_html_e('Dashboard', 'salesking');?></span>
                       </a>
                   </li><!-- .nk-menu-item -->

                   <?php do_action('salesking_extend_menu_start'); ?>
                   
                    <?php

                    $menu_array = apply_filters('salesking_dashboard_menu',array(
                        'messages' => array('salesking_enable_messages_setting', 'messages', 'ni-chat-fill', esc_html__('Messages', 'salesking')),
                        'coupons' => array('salesking_enable_coupons_setting', 'coupons', 'ni-wallet-saving', esc_html__('Coupons', 'salesking')),
                        'offers-b2b' => array('salesking_enable_offers_page', 'offers-b2b', 'ni-tags-fill', esc_html__('Offers', 'salesking')),
                        'cart-sharing' => array('salesking_enable_cart_sharing_setting', 'cart-sharing', 'ni-cart', esc_html__('Cart Sharing', 'salesking')),
                        'affiliate-links' => array('salesking_enable_affiliate_links_setting', 'affiliate-links', 'ni-link', esc_html__('Affiliate Links', 'salesking')),
                        'customers' => array('salesking_enable_my_customers_page', 'customers', 'ni-users-fill', esc_html__('My Customers', 'salesking')),
                        'orders' => array('salesking_agents_can_manage_orders_setting', 'orders', 'ni-bag-fill', esc_html__('My Orders', 'salesking')),
                        'team' => array('salesking_enable_teams_setting', 'team', 'ni-network', esc_html__('My Team', 'salesking')),
                        'earnings' => array('salesking_enable_earnings_setting', 'earnings', 'ni-coins', esc_html__('Earnings', 'salesking')),
                        'payouts' => array('salesking_enable_payouts_setting', 'payouts', 'ni-wallet-out', esc_html__('Payouts', 'salesking')),
                        'profile' => array('salesking_enable_profile_setting', 'profile', 'ni-account-setting-fill', esc_html__('Profile', 'salesking')),
                    ));

                    // only if b2bking pro enabled + offers enabled
                    if ( ! defined('B2BKING_DIR') || intval(get_option('b2bking_enable_offers_setting', 1)) !== 1 || intval(get_option('salesking_enable_offers_setting', 1)) !== 1){
                        unset($menu_array['offers-b2b']);
                    }

                    $menu_array = apply_filters('salesking_dashboard_menu_items', $menu_array);

                    foreach ($menu_array as $menu_item){
                        if (intval(apply_filters($menu_item[0],get_option( $menu_item[0], 1 ))) === 1 ){
                            ?>
                            <li class="nk-menu-item">
                                <a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).$menu_item[1];?>" class="nk-menu-link">
                                    <span class="nk-menu-icon"><em class="icon ni <?php echo esc_attr($menu_item[2]);?>"></em></span>
                                    <span class="nk-menu-text"><?php echo esc_html($menu_item[3]);?></span>
                                    <?php if ($unread_msg !== 0 && $menu_item[1] === 'messages'){ ?>
                                        <span class="nk-menu-badge badge-danger"><?php echo esc_html($unread_msg).esc_html__(' New', 'salesking');?></span>
                                    <?php } ?>
                                </a>
                            </li><!-- .nk-menu-item -->
                            <?php
                        }
                    }
                    ?>

                    <?php do_action('salesking_extend_menu'); ?>

                </ul><!-- .nk-menu -->
            </div><!-- .nk-sidebar-menu -->
        </div><!-- .nk-sidebar-content -->
    </div><!-- .nk-sidebar-element -->
</div>