import express from 'express';
import rootRoutes from './routes/root';
import testRoutes from './routes/test';

const app = express();
const PORT = process.env.PORT || 3000;



app.use('/', rootRoutes);
app.use("/test", testRoutes);

// Basic route for testing

app.get('/', (req, res) => {
  res.send('Hello, World!');
});
