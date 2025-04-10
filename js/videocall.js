import { test_connection } from './connection_test.js';

const test_urls = [
    "https://supacall.onrender.com",
    "https://socket-io-7yss.onrender.com",
    "http://localhost:10000"
];

document.addEventListener('DOMContentLoaded', function() {
    const existing_header = document.querySelector('header');
    if (existing_header) {
        existing_header.remove();
    }

    const header = jte({
        tag: 'header'
    });

    const category = jte({
        tag: 'category'
    });

    test_urls.forEach(url => {
        const button = jte({
            tag: 'button',
            textnode: `Testar ${url}`,
            onclick: () => test_connection(url)
        });
        category.appendChild(button);
    });

    header.appendChild(category);
    document.body.appendChild(header);

    const open_dialog_button = jte({
        tag: 'button',
        textnode: 'Abrir Dialog',
        onclick: () => {
            const dialog = jte({
                tag: 'dialog',
                type: 'supacall'
            });

            const close_button = jte({
                tag: 'button',
                textnode: 'Fechar',
                onclick: () => dialog.close()
            });

            dialog.appendChild(close_button);
            document.body.appendChild(dialog);
            dialog.showModal();
        }
    });
    document.body.appendChild(open_dialog_button);
});