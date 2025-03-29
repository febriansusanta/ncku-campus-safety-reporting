// Import required modules
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_report';
mongoose.connect(MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Report Schema
const reportSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    type: String,
    time: Date,
    status: { type: String, default: 'Pending' },
    description: { type: String, default: '' },
    urgency: String,
    photo: String
}, {
    // Remove the __v field from the output
    versionKey: false
});

// Create Report model
const Report = mongoose.model('Report', reportSchema);

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
try {
    if (!fs.existsSync(uploadsDir)) {
        console.log('Creating uploads directory:', uploadsDir);
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (err) {
    console.error('Error creating uploads directory:', err);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // For ANY custom type that isn't one of the standard types, use the "Other" folder
        const standardTypes = ['Road', 'Accessible Ramp', 'Street Light'];
        let typeDir = 'Other';
        
        if (req.body && req.body.type && standardTypes.includes(req.body.type)) {
            typeDir = req.body.type.toLowerCase().replace(/ /g, '_');
        }
        
        console.log(`Storing file for type "${req.body.type}" in directory: ${typeDir}`);
        
        const typePath = path.join(uploadsDir, typeDir);
        try {
            if (!fs.existsSync(typePath)) {
                console.log('Creating type directory:', typePath);
                fs.mkdirSync(typePath, { recursive: true });
            }
            cb(null, typePath);
        } catch (err) {
            console.error('Error creating type directory:', err);
            cb(err);
        }
    },
    filename: function (req, file, cb) {
        // Create a unique filename with date and original extension
        const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const fileExt = path.extname(file.originalname);
        const filename = `${dateStr}_${path.basename(file.originalname, fileExt)}${fileExt}`;
        console.log('Generated filename:', filename);
        cb(null, filename);
    }
});

// File filter to only accept images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Create multer upload middleware
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
}).single('photo');

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from public directory (for frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to delete a file
const deleteFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Deleted file:', filePath);
        }
    } catch (err) {
        console.error('Error deleting file:', err);
    }
};

// Routes
app.get('/reports', async (req, res) => {
    try {
        const reports = await Report.find();
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Error fetching reports' });
    }
});

// Ensure the SPA works with client-side routing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/reports', async (req, res) => {
    console.log('Received POST request for new report');
    
    upload(req, res, async function(err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer error during upload:', err);
            return res.status(500).json({ error: `Multer upload error: ${err.message}` });
        } else if (err) {
            console.error('Unknown error during upload:', err);
            return res.status(500).json({ error: `Unknown upload error: ${err.message}` });
        }
        
        // Log request body and file
        console.log('Request body:', req.body);
        console.log('Uploaded file:', req.file);
        
        try {
            // Standardize type for consistency
            const standardTypes = ['Road', 'Accessible Ramp', 'Street Light'];
            const finalType = req.body.type;
            
            // Create a new report
            const reportData = {
                lat: parseFloat(req.body.lat),
                lng: parseFloat(req.body.lng),
                type: finalType,
                time: new Date(req.body.time || Date.now()),
                status: req.body.status || 'Pending',
                description: req.body.description || '',
                urgency: req.body.urgency
            };
            
            // Add photo URL if a file was uploaded
            if (req.file) {
                // Use relative path for storage in DB
                const relativePath = path.relative(
                    path.join(__dirname),
                    req.file.path
                ).replace(/\\/g, '/');
                
                reportData.photo = `/${relativePath}`;
                console.log('Saved photo path:', reportData.photo);
            }
            
            const report = new Report(reportData);
            await report.save();
            console.log('New report saved successfully:', report._id);
            res.status(201).json(report);
        } catch (error) {
            console.error('Error saving report:', error);
            res.status(500).json({ error: 'Error saving report', details: error.message });
        }
    });
});

app.put('/reports/:id', async (req, res) => {
    console.log(`Received PUT request for report ${req.params.id}`);
    
    upload(req, res, async function(err) {
        if (err) {
            console.error('Error during upload:', err);
            return res.status(500).json({ error: `Upload error: ${err.message}` });
        }
        
        console.log('Request body for update:', req.body);
        console.log('Uploaded file for update:', req.file);
        
        try {
            // Find the existing report
            const report = await Report.findById(req.params.id);
            if (!report) {
                return res.status(404).json({ error: 'Report not found' });
            }
            
            // Standard types list for consistency
            const standardTypes = ['Road', 'Accessible Ramp', 'Street Light'];
            
            // Check if type has changed between standard types or to/from Other
            const originalTypeIsStandard = standardTypes.includes(report.type);
            const newTypeIsStandard = req.body.type && standardTypes.includes(req.body.type);
            const typeChanged = originalTypeIsStandard !== newTypeIsStandard || 
                              (originalTypeIsStandard && newTypeIsStandard && report.type !== req.body.type);
            
            // Update report data
            report.type = req.body.type || report.type;
            report.time = req.body.time ? new Date(req.body.time) : report.time;
            report.status = req.body.status || report.status;
            report.description = req.body.description || report.description;
            report.urgency = req.body.urgency || report.urgency;
            
            // Handle photo updates
            if (req.file) {
                // If there's an existing photo, delete it
                if (report.photo && report.photo !== '') {
                    const oldPhotoPath = path.join(__dirname, report.photo);
                    deleteFile(oldPhotoPath);
                }
                
                // Use relative path for storage in DB
                const relativePath = path.relative(
                    path.join(__dirname),
                    req.file.path
                ).replace(/\\/g, '/');
                
                report.photo = `/${relativePath}`;
                console.log('Updated photo path:', report.photo);
            } else if (typeChanged && report.photo) {
                // If type changed but no new photo, move existing photo to new type folder
                const oldPhotoPath = path.join(__dirname, report.photo);
                const oldPhotoName = path.basename(report.photo);
                
                // Determine new folder based on type
                let newTypeDir = 'Other';
                if (standardTypes.includes(req.body.type)) {
                    newTypeDir = req.body.type.toLowerCase().replace(/ /g, '_');
                }
                
                console.log(`Moving photo to ${newTypeDir} folder`);
                
                const newTypePath = path.join(uploadsDir, newTypeDir);
                if (!fs.existsSync(newTypePath)) {
                    fs.mkdirSync(newTypePath, { recursive: true });
                }
                
                const newPhotoPath = path.join(newTypePath, oldPhotoName);
                
                // Check if the file exists before attempting to move it
                if (fs.existsSync(oldPhotoPath)) {
                    try {
                        fs.renameSync(oldPhotoPath, newPhotoPath);
                        console.log(`Successfully moved photo from ${oldPhotoPath} to ${newPhotoPath}`);
                    } catch (err) {
                        console.error(`Error moving file: ${err.message}`);
                        // If we can't move it (e.g., across devices), copy and delete
                        fs.copyFileSync(oldPhotoPath, newPhotoPath);
                        deleteFile(oldPhotoPath);
                        console.log(`Copied and deleted instead of moving`);
                    }
                    
                    // Update photo path in database
                    const newRelativePath = path.relative(
                        path.join(__dirname),
                        newPhotoPath
                    ).replace(/\\/g, '/');
                    
                    report.photo = `/${newRelativePath}`;
                    console.log('Updated photo path after move:', report.photo);
                } else {
                    console.warn(`Could not find original photo at ${oldPhotoPath}`);
                }
            }
            
            await report.save();
            console.log('Report updated successfully:', report._id);
            res.json(report);
        } catch (error) {
            console.error('Error updating report:', error);
            res.status(500).json({ error: 'Error updating report', details: error.message });
        }
    });
});

app.delete('/reports/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Delete associated photo if it exists
        if (report.photo && report.photo !== '') {
            const photoPath = path.join(__dirname, report.photo);
            deleteFile(photoPath);
        }
        
        await Report.findByIdAndDelete(req.params.id);
        console.log('Report deleted successfully:', req.params.id);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Error deleting report' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 