module.exports = function setupRoutes(app) {
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({ 
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });

    // Home page
    app.get('/', (req, res, next) => {
        res.render('index', (err, html) => {
            if (err) {
                next(err);
            } else {
                res.send(html);
            }
        });
    });

    // Developer link
    app.get('/developer', (req, res) => {
        res.redirect('https://gravatar.com/floawd');
    });
};