(function () {
    const config = window.myAliceConfig || { apiUrl: 'http://localhost:3001' };

    async function initWidget() {
        try {
            const res = await fetch(`${config.apiUrl}/api/widget-config`);
            const widgetData = await res.json();

            if (!widgetData || !widgetData.is_active) return;

            renderWidget(widgetData);
        } catch (e) {
            console.error('MyAlice Widget Error:', e);
        }
    }

    function renderWidget(data) {
        // Create container
        const container = document.createElement('div');
        container.id = 'myalice-widget-root';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style[data.position === 'right' ? 'right' : 'left'] = '20px';
        container.style.zIndex = '999999';
        container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

        // Shadow DOM for isolation
        const shadow = container.attachShadow({ mode: 'open' });

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            .widget-wrapper { display: flex; flex-direction: column; align-items: ${data.position === 'right' ? 'flex-end' : 'flex-start'}; gap: 12px; }
            .main-button { width: 60px; height: 60px; border-radius: 50%; background-color: ${data.bg_color}; color: ${data.text_color}; display: flex; items-center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; border: none; }
            .main-button:hover { transform: scale(1.05); }
            .main-button svg { width: 30px; height: 30px; fill: currentColor; }
            
            .channels-container { display: none; flex-direction: column; gap: 8px; align-items: ${data.position === 'right' ? 'flex-end' : 'flex-start'}; }
            .channels-container.open { display: flex; }
            
            .channel-btn { background: white; border-radius: 50px; padding: 10px 16px; display: flex; align-items: center; gap: 10px; text-decoration: none; color: #333; font-weight: bold; font-size: 14px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border: 1px solid #eee; transition: transform 0.2s; }
            .channel-btn:hover { transform: scale(1.02); }
            
            .icon-circle { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
            .icon-whatsapp { background-color: #25D366; }
            .icon-facebook { background-color: #0084FF; }
            .icon-instagram { background-image: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); }
            .icon-webchat { background-color: #5A59D5; }
            
            .welcome-bubble { background: white; border-radius: 12px; padding: 12px 16px; font-size: 13px; color: #444; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 220px; border: 1px solid #f0f0f0; margin-bottom: 4px; }
        `;

        const wrapper = document.createElement('div');
        wrapper.className = 'widget-wrapper';

        // Welcome bubble
        if (data.welcome_text) {
            const bubble = document.createElement('div');
            bubble.className = 'welcome-bubble';
            bubble.textContent = data.welcome_text;
            wrapper.appendChild(bubble);
        }

        // Channels
        const channelsDiv = document.createElement('div');
        channelsDiv.className = 'channels-container';

        let chatIframe = null;

        data.channels.forEach(ch => {
            const a = document.createElement(ch.provider === 'webchat' ? 'button' : 'a');
            a.className = 'channel-btn';

            if (ch.provider !== 'webchat') {
                a.href = ch.provider === 'whatsapp' ? `https://wa.me/${ch.url}` : ch.url;
                a.target = '_blank';
            } else {
                a.style.border = 'none';
                a.style.cursor = 'pointer';
                a.style.fontFamily = 'inherit';
                a.onclick = () => {
                    if (!chatIframe) {
                        chatIframe = document.createElement('iframe');
                        // Derive livechat URL from widget config or apiUrl
                        const livechatUrl = data.livechat_url || config.apiUrl.replace('api-crm', 'crm').replace(/:\d+$/, '') + '/livechat';
                        chatIframe.src = livechatUrl;
                        chatIframe.style.width = '350px';
                        chatIframe.style.height = '500px';
                        chatIframe.style.border = 'none';
                        chatIframe.style.borderRadius = '16px';
                        chatIframe.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                        chatIframe.style.position = 'absolute';
                        chatIframe.style.bottom = '80px';
                        chatIframe.style[data.position === 'right' ? 'right' : 'left'] = '0';
                        chatIframe.style.display = 'none';
                        wrapper.appendChild(chatIframe);
                    }
                    if (chatIframe.style.display === 'none') {
                        chatIframe.style.display = 'block';
                    } else {
                        chatIframe.style.display = 'none';
                    }
                };
            }

            const icon = document.createElement('div');
            icon.className = `icon-circle icon-${ch.provider}`;
            icon.innerHTML = getIconSvg(ch.provider);

            const span = document.createElement('span');
            span.textContent = ch.label;

            a.appendChild(span);
            a.appendChild(icon);
            channelsDiv.appendChild(a);
        });

        wrapper.appendChild(channelsDiv);

        // Main button
        const mainBtn = document.createElement('button');
        mainBtn.className = 'main-button';
        mainBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
        mainBtn.onclick = () => {
            channelsDiv.classList.toggle('open');
        };

        wrapper.appendChild(mainBtn);

        shadow.appendChild(style);
        shadow.appendChild(wrapper);
        document.body.appendChild(container);
    }

    function getIconSvg(provider) {
        if (provider === 'webchat') return '<svg style="width:18px;height:18px" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2C6.477,2,2,6.477,2,12c0,5.523,4.477,10,10,10c5.523,0,10-4.477,10-10C22,6.477,17.523,2,12,2z M12,20.25c-4.556,0-8.25-3.694-8.25-8.25c0-4.556,3.694-8.25,8.25-8.25c4.556,0,8.25,3.694,8.25,8.25C20.25,16.556,16.556,20.25,12,20.25z M10 14h4v-2h-4v2z "/></svg>';
        if (provider === 'whatsapp') return '<svg style="width:18px;height:18px" viewBox="0 0 24 24"><path fill="currentColor" d="M12.011 20.914c-1.554 0-3.047-.406-4.352-1.175l-4.529 1.487 1.514-4.412a8.878 8.878 0 01-1.28-4.636c0-4.909 3.991-8.9 8.9-8.9s8.9 3.991 8.9 8.9-3.991 8.902-8.9 8.902V20.914zM12.011 4.542c-3.955 0-7.165 3.21-7.165 7.165 0 1.54.494 3.033 1.424 4.281L5.341 18.2l3.35-.889a7.125 7.125 0 003.32.825c3.955 0 7.165-3.21 7.165-7.165s-3.21-7.172-7.165-7.172z" /></svg>';
        if (provider === 'instagram') return '<svg style="width:18px;height:18px" viewBox="0 0 24 24"><path fill="currentColor" d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M18,5.75A0.75,0.75 0 0,0 17.25,5A0.75,0.75 0 0,0 16.5,5.75A0.75,0.75 0 0,0 17.25,6.5A0.75,0.75 0 0,0 18,5.75Z" /></svg>';
        return '<svg style="width:18px;height:18px" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2C6.477,2,2,6.477,2,12c0,5.523,4.477,10,10,10c5.523,0,10-4.477,10-10C22,6.477,17.523,2,12,2z M12,20.25c-4.556,0-8.25-3.694-8.25-8.25c0-4.556,3.694-8.25,8.25-8.25c4.556,0,8.25,3.694,8.25,8.25C20.25,16.556,16.556,20.25,12,20.25z"/></svg>';
    }

    if (document.readyState === 'complete') initWidget();
    else window.addEventListener('load', initWidget);
})();
