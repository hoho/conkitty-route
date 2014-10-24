/* global $CR */
(function($CR) {
    'use strict';

    $CR
        .add('/', {
            render: 'main',
            frames: {
                '/': {
                    data: '/api/folders',
                    parent: '.container',
                    frames: {
                        '/:?folder': {
                            id: 'folder',
                            params: {
                                folder: function(val) { return val || 'Inbox'; }
                            },
                            data: '/api/messages?folder=:folder',
                            render: {
                                '-before': 'folders',
                                '+success': 'folders'
                            },
                            frames: {
                                '/:?message': {
                                    id: 'message',
                                    data: {
                                        override: function(params) { if (!params.message) { return null; }},
                                        uri: '/api/message?folder=::folder&message=:message'
                                    },
                                    render: {
                                        '-before': 'messages',
                                        success: ['messages', 'message']
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
        .add('/about', {
            render: 'about'
        })
        .run();
})($CR);
