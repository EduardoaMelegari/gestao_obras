import axios from 'axios';

const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHlUaE1_7XtdwIBnBdpQslgLfuUF4nYkcb5naBD-r6wO1fvF71H7MSFS7aAgo23ZcWDV6NWNv60tXo/pub?gid=632152560&single=true&output=csv';

async function fetchHeaders() {
    try {
        const response = await axios.get(url);
        const lines = response.data.split('\n');
        console.log("HEADERS:", lines[0]);
        console.log("FIRST ROW:", lines[1]);
    } catch (error) {
        console.error(error);
    }
}

fetchHeaders();
