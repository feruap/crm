jQuery(document).ready(function ($) {
    'use strict';
    if (viwot_preview_setting?.tracking_page_url) {
        wp.customize.panel('vi_wot_orders_tracking_design', function (section) {
            section.expanded.bind(function (isExpanded) {
                if (isExpanded) {
                    wp.customize.previewer.previewUrl.set(viwot_preview_setting.tracking_page_url);
                }
            });
        });
    }
    wp.customize.section('vi_wot_orders_tracking_design_general', function (section) {
        section.expanded.bind(function (isExpanded) {
            if (isExpanded) {
                wp.customize.previewer.send('vi_wot_orders_tracking_design_general', 'show');
            }
        })
    });
    wp.customize.section('vi_wot_orders_tracking_design_template_one', function (section) {
        section.expanded.bind(function (isExpanded) {
            if (isExpanded) {
                wp.customize.previewer.send('vi_wot_orders_tracking_design_template_one', 'show');
            }
        })
    });
});