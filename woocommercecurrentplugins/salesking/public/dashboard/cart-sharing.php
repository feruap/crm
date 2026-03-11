<?php
if (intval(get_option( 'salesking_enable_cart_sharing_setting', 1 )) === 1){

    ?>
    <div class="nk-content salesking_cart_sharing_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="components-preDelete wide-md mx-auto">
                        <div class="nk-block-head nk-block-head-sm">
                            <div class="nk-block-between">
                                <div class="nk-block-head-content">
                                    <h3 class="nk-block-title page-title"><?php esc_html_e('Cart Sharing','salesking');?></h3>
                                    <div class="nk-block-des text-soft">
                                        <p><?php esc_html_e('Create and share cart links with your customers, allowing them to easily place orders with the exact products they need. ','salesking');
                                            echo '<br>'; esc_html_e('To place orders on behalf of customers directly, and only send them the payment link, go to ', 'salesking');
                                            echo '<a href="'.esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).'customers'.'">'.esc_html__('My Customers -> Shop as Customer', 'salesking').'</a>';
                                        ?></p>
                                    </div>
                                </div><!-- .nk-block-head-content -->
                               
                            </div><!-- .nk-block-between -->
                        </div><!-- .nk-block-head -->
                        <div class="nk-block nk-block-lg mb-4">
                            <div class="card bg-gray text-white">
                                <div class="card-inner">
                                    <div class="nk-block-head">
                                        <div class="nk-block-head-content">
                                            <h4 class="nk-block-title"><?php esc_html_e('Share Links','salesking');?></h4>
                                        </div>
                                    </div>
                                    <table class="datatable-init nowrap nk-tb-list is-separate" data-auto-responsive="false">
                                        <thead>
                                            <tr class="nk-tb-item nk-tb-head">
                                                <th class="nk-tb-col tb-col-sm"><span><?php esc_html_e('Cart Name', 'salesking');?></span></th>
                                                <th class="nk-tb-col"><span><?php esc_html_e('Shareable Cart Link', 'salesking');?></span></th>
                                                <th class="nk-tb-col"><span><?php esc_html_e('Copy', 'salesking');?></span></th>
                                                <th class="nk-tb-col tb-col-sm"><span><?php esc_html_e('Delete', 'salesking');?></span></th>
                                            </tr><!-- .nk-tb-item -->
                                        </thead>
                                        <tbody>
                                            <?php
                                            // get all carts and show them
                                            $carts = get_user_meta(get_current_user_id(),'salesking_agent_carts', true);
                                            $carts = explode('AAAENDAAA', $carts);
                                            foreach ($carts as $cart){
                                                if (!empty($cart)){
                                                    $cartstring = explode('AAANAMEAAA', $cart);
                                                    $cartname = $cartstring[0];
                                                    $cartlink = get_user_meta(get_current_user_id(),'salesking_agentid', true).'-'.$cartname;


                                                    ?>
                                                    <tr class="nk-tb-item">
                                                        <td class="nk-tb-col tb-col-sm">
                                                            <span class="tb-product">
                                                                <em class="icon ni ni-cart-fill thumb salesking_cart_thumb"></em>
                                                                <span class="title"><?php echo esc_html($cartname);?></span>
                                                            </span>
                                                        </td>
                                                        <td class="nk-tb-col salesking_cart_link_container">
                                                            <span class="tb-sub"><a href="<?php echo get_permalink( wc_get_page_id( 'cart' ) ).'?mycart='.esc_html($cartlink);?>"><?php echo esc_url(get_permalink( wc_get_page_id( 'cart' ) ).'?mycart='.esc_html($cartlink));?></span>
                                                        </td>
                                                        <td class="nk-tb-col">
                                                            <span class="tb-lead"><button class="btn btn-sm btn-secondary salesking_copy_cart_link" value="<?php echo get_permalink( wc_get_page_id( 'cart' ) ).'?mycart='.esc_html($cartlink);?>"><?php esc_html_e('Copy Link','salesking');?></button></span>
                                                        </td>
                                                        <td class="nk-tb-col tb-col-sm">
                                                            <span class="tb-sub"><button class="btn btn-sm btn-light salesking_delete_cart_link" value="<?php echo esc_attr($cartname);?>"><?php esc_html_e('Delete Cart','salesking');?></button></span>
                                                        </td>
                                                        
                                                    </tr><!-- .nk-tb-item -->

                                                    <?php
                                                }
                                                
                                            }
                                            ?>
                                          

                                        </tbody>
                                    </table><!-- .nk-tb-list -->
                                </div>
                            </div>
                        </div> <!-- nk-block -->
                        <div class="nk-block nk-block-lg">
                            <div class="nk-block-head">
                                <div class="nk-block-head-content">
                                    <h4 class="nk-block-title"><?php esc_html_e('Create Cart','salesking');?></h4>
                                    <div class="nk-block-des text-soft">
                                        <p><?php esc_html_e('To create a personalized sharable cart, ','salesking');
                                        echo '<a href="'.esc_attr(get_permalink( wc_get_page_id( 'shop' ) ) ).'">'.esc_html__('add products to cart from the storefront.', 'salesking').'</a>'; 
                                        esc_html_e(' Those products will be displayed on this page.', 'salesking');
                                        ?></p>
                                </div>
                            </div>
                            <br>
                            <div class="form-group">
                                <label class="form-label" for="default-03"><?php esc_html_e('Enter Cart Name:','salesking');?></label>
                                <div class="row g-gs">
                                    <div class="col-xxl-6 col-sm-6">
                                        <div class="form-control-wrap">
                                            <div class="form-icon form-icon-left">
                                                <em class="icon ni ni-cart-fill"></em>
                                            </div>
                                            <input type="text" class="form-control" id="salesking_create_cart_name" placeholder="<?php esc_attr_e('Enter the cart name here...','salesking');?>">
                                        </div>
                                    </div>
                                    <div class="col-xxl-2 col-sm-2">
                                        <button type="submit" class="btn btn-primary" id="salesking_create_cart_button"><?php esc_html_e('Create','salesking');?></button>
                                    </div>
                                </div>
                            </div>
                            <table class="nowrap nk-tb-list is-separate" data-auto-responsive="false">
                                <thead>
                                    <tr class="nk-tb-item nk-tb-head">
                                        <th class="nk-tb-col"><span><?php esc_html_e('Product', 'salesking');?></span></th>
                                        <th class="nk-tb-col"><span><?php esc_html_e('SKU', 'salesking');?></span></th>
                                        <th class="nk-tb-col"><span><?php esc_html_e('Price', 'salesking');?></span></th>
                                        <th class="nk-tb-col"><span><?php esc_html_e('Quantity', 'salesking');?></span></th>
                                    </tr><!-- .nk-tb-item -->
                                </thead>
                                <tbody>
                                    <?php
                                        $items = WC()->cart->get_cart();

                                        foreach($items as $item => $values) { 
                                            $product =  wc_get_product( $values['data']->get_id() );
                                            $price = $product->get_price();
                                            ?>
                                            <tr class="nk-tb-item">

                                                <td class="nk-tb-col">
                                                    <span class="tb-product salesking_image_wrapper_cart">
                                                        <?php echo $product->get_image('woocommerce_gallery_thumbnail'); ?>
                                                        <span class="title thumb salesking_cart_thumb"><?php echo esc_html($product->get_title());?></span>
                                                    </span>
                                                </td>
                                                <td class="nk-tb-col">
                                                    <span class="tb-sub"><?php echo esc_html($product->get_sku());?></span>
                                                </td>
                                                <td class="nk-tb-col">
                                                    <span class="tb-lead"><?php echo wc_price($price);?></span>
                                                </td>
                                                <td class="nk-tb-col">
                                                    <span class="tb-sub"><?php echo esc_html($values['quantity']);?></span>
                                                </td>
                                                
                                            </tr><!-- .nk-tb-item -->
                                            <?php
                                        }
                                    ?>
                                </tbody>

                            </table><!-- .nk-tb-list -->
                        </div>
                    </div><!-- .nk-block -->
                </div>
            </div>
        </div>
    </div>
    <?php
}
?>