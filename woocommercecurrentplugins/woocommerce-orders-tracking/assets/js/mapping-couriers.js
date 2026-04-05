jQuery(document).ready(function ($) {
    'use strict';
    let $couriers = $('#couriers'), $couriers_select = $('#couriers_select'),
        couriers_mapping_name = woo_orders_tracking_mapping_couriers.couriers_mapping_name,
        couriers_mapping = woo_orders_tracking_mapping_couriers.couriers_mapping,
        courier_mapping_rows = '', couriers = woo_orders_tracking_mapping_couriers.couriers,
        carriers_selection = '<option value=""></option>', dianxiaomi_get_couriers = get_couriers();
    if (woo_orders_tracking_mapping_couriers.carriers.length > 0) {
        for (let i in woo_orders_tracking_mapping_couriers.carriers) {
            carriers_selection += `<option value="${woo_orders_tracking_mapping_couriers.carriers[i]['slug']}">${woo_orders_tracking_mapping_couriers.carriers[i]['name']}</option>`;
        }
    }
    if (couriers.length > 0) {
        for (let i in couriers) {
            courier_mapping_rows += `<tr><td>${dianxiaomi_find_carrier_name(couriers[i])}</td><td><select name="${couriers_mapping_name}[${couriers[i]}]">${carriers_selection}</select></td></tr>`;
        }
    }
    let $table = $(`<table class="widefat fixed striped" style="margin: 10px 0">
<thead>
<tr>
<th>${woo_orders_tracking_mapping_couriers.couriers_title}</th>
<th>Woo Orders Tracking carrier</th>
</tr>
</thead>
<tbody>${courier_mapping_rows}</tbody>
</table>`);
    $table.insertAfter($couriers);

    for (let i in couriers_mapping) {
        $(`select[name="${couriers_mapping_name}[${i}]"]`).val(couriers_mapping[i]).trigger('change');
    }
    $couriers_select.on('change', function () {
        let couriers_select = $couriers_select.val();
        if (couriers_select.length > couriers.length) {

            for (let i in couriers_select) {
                if (couriers.indexOf(couriers_select[i]) === -1) {
                    console.log(couriers_select[i])
                    let $carriers_selection = $(`<select name="${couriers_mapping_name}[${couriers_select[i]}]">${carriers_selection}</select>`);
                    $table.find('tbody').append(`<tr><td>${dianxiaomi_find_carrier_name(couriers_select[i])}</td><td>${$carriers_selection.get(0).outerHTML}</td></tr>`);
                    couriers.push(couriers_select[i])
                    break;
                }
            }
        } else {
            for (let i in couriers) {
                if (couriers_select.indexOf(couriers[i]) === -1) {
                    console.log(couriers[i])
                    $table.find(`select[name="${couriers_mapping_name}[${couriers[i]}]"]`).closest('tr').remove();
                    couriers.splice(i, 1);
                    break;
                }
            }
        }
    });

    function dianxiaomi_find_carrier_name(slug) {
        let name = '';
        if (slug) {
            for (let i in dianxiaomi_get_couriers) {
                if (slug === dianxiaomi_get_couriers[i]['slug']) {
                    name = dianxiaomi_get_couriers[i]['name'];
                    break;
                }
            }

        }
        return name;
    }
});