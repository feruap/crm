<?php
if (intval(get_option( 'salesking_enable_affiliate_links_setting', 1 )) === 1){
  
    ?>
    <div class="nk-content salesking_affiliate_links_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="components-preDelete wide-md mx-auto">
                        <div class="nk-block-head nk-block-head-sm">
                            <div class="nk-block-between">
                                <div class="nk-block-head-content">
                                    <h3 class="nk-block-title page-title"><?php esc_html_e('Affiliate Links','salesking');?></h3>
                                    <div class="nk-block-des text-soft">
                                        <p><?php esc_html_e('Share your affiliate links with potential customers, and earn a commission when they are used!','salesking');?></p>
                                    </div>
                                </div><!-- .nk-block-head-content -->
                               
                            </div><!-- .nk-block-between -->
                        </div><!-- .nk-block-head -->
                        <div class="nk-block">
                            <div class="row g-gs">
                                <div class="col-xxl-12 col-sm-12">
                                    <div class="card is-dark text-white">
                                        <div class="card-inner">
                                            <div class="card-head">
                                                <h5 class="card-title"><?php esc_html_e('Your Links','salesking');?></h5>
                                            </div>
                                            <form action="#" class="gy-3">
                                                <?php
                                                ob_start();

                                                ?>
                                                <div class="row g-3 align-center">
                                                    <div class="col-lg-5">
                                                        <div class="form-group">
                                                            <label class="form-label text-white fs-15px" for="site-name"><?php esc_html_e('Registration Link','salesking');?></label>
                                                            <span class="form-note fs-13px"><?php esc_html_e('Customers that register with this link are assigned to you.','salesking');?></span>
                                                        </div>
                                                    </div>
                                                    <div class="col-lg-7">
                                                        <div class="form-group">
                                                            <div class="form-control-wrap">
                                                                <input type="text" class="form-control w-80 d-inline" id="salesking_registration_link" value="<?php echo esc_attr(apply_filters('salesking_registration_page_link',  get_permalink( wc_get_page_id( 'myaccount' ) )).'?regid='.$agent_id);?>" readonly>
                                                                <button type="button" id="salesking_registration_link_button" class="btn btn-lighter w-10 d-inline bottom-1" data-toggle="tooltip" data-placement="top" title="<?php esc_attr_e('Copy to clipboard','salesking');?>"><?php esc_html_e('Copy','salesking');?></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="row g-3 align-center">
                                                    <div class="col-lg-5">
                                                        <div class="form-group">
                                                            <label class="form-label text-white fs-15px"><?php esc_html_e('Shopping Link','salesking');?></label>
                                                            <span class="form-note fs-13px"><?php esc_html_e('This link contains a tracking cookie and links orders to you.','salesking');?></span>
                                                        </div>
                                                    </div>
                                                    <div class="col-lg-7">
                                                        <div class="form-group">
                                                            <div class="form-control-wrap">
                                                               <input type="text" class="form-control w-80 d-inline" id="salesking_shopping_link" value="<?php 


                                                                $link = get_permalink( wc_get_page_id( 'shop' ) ).'?affid='.$agent_id;
                                                                $link = apply_filters( 'salesking_shopping_affiliate_link_dashboard', $link, $agent_id);

                                                               if (defined('MARKETKINGCORE_DIR')){
                                                                if (marketking()->is_vendor(get_current_user_id())){
                                                                    
                                                                    $link = marketking()->get_store_link(get_current_user_id()).'?affid='.$agent_id;
                                                                }
                                                               }

                                                               echo esc_attr($link);

                                                               ?>" readonly>
                                                                <button type="button" id="salesking_shopping_link_button" class="btn btn-lighter w-10 d-inline bottom-1" data-toggle="tooltip" data-placement="top" title="<?php esc_attr_e('Copy to clipboard','salesking');?>"><?php esc_html_e('Copy','salesking');?></button>

                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="row g-3 align-center">
                                                    <div class="col-lg-5">
                                                        <div class="form-group">
                                                            <label class="form-label text-white fs-15px"><?php esc_html_e('Product Link Generator','salesking');?></label>
                                                            <span class="form-note fs-13px"><?php esc_html_e('Enter a product link here, and get your affiliate link.','salesking');?></span>
                                                        </div>
                                                    </div>
                                                    <div class="col-lg-7">
                                                        <div class="form-group">
                                                            <div class="form-control-wrap">
                                                               <input type="text" class="form-control w-80 d-inline" id="salesking_generator_link" placeholder="<?php esc_attr_e('Copy & paste a product link here...','salesking');?>">
                                                                <button type="button" id="salesking_generator_link_button" class="btn btn-lighter w-10 d-inline bottom-1" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('Get link and copy to clipboard','salesking');?>"><?php esc_html_e('Get Link','salesking');?></button>

                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <?php
                                                $content = ob_get_clean();
                                                echo apply_filters('salesking_affiliate_links_columns',$content);
                                                ?>
                                            </form>
                                        </div>
                                        <div class="card-footer border-top text-white bg-gray"><?php esc_html_e('Your Agent ID:','salesking');?> <strong><?php
                                        
                                        echo esc_html($agent_id);

                                        ?></strong></div>

                                    </div>

                                </div><!-- .col -->

                                

                            </div>
                        </div><!-- .row -->
                    </div><!-- .nk-block -->
                </div>
            </div>
        </div>
    </div>
    <?php
}
?>