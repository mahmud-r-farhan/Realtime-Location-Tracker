module.exports = function setupRoutes(app) {
    app.get('/', (req, res) => {
        res.render('index');
    });

    app.get('/developer', (req, res) => {
        res.redirect('https://gravatar.com/floawd');
    });
};