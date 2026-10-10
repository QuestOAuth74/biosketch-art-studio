import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { existsSync } from 'fs';

// Load environment variables
// Load .env first (base configuration), then .env.local (overrides)
// This allows .env.local to override specific keys while falling back to .env for others
const envPath = '.env';
const envLocalPath = '.env.local';

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const devEnv = process.env;

// The signed URL from the code
const SIGNED_URL = 'https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0';

const BUCKET_NAME = 'icon site';
const FILE_NAME = 'biosketch art-min.png';

async function downloadAndUploadLogo() {
  if (!devEnv.VITE_SUPABASE_URL || !devEnv.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
    return;
  }

  // Create dev Supabase client with service role
  const devSupabase = createClient(
    devEnv.VITE_SUPABASE_URL!,
    devEnv.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('📥 Downloading logo from production...');

  try {
    const response = await fetch(SIGNED_URL);

    if (!response.ok) {
      console.error(`❌ Failed to download: ${response.status} ${response.statusText}`);
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`✅ Downloaded logo (${buffer.length} bytes)`);

    // Check if bucket exists
    console.log('\n🔍 Checking if bucket exists in development...');
    const { data: buckets } = await devSupabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      console.log('📦 Creating "icon site" bucket...');
      const { error: createError } = await devSupabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError);
        return;
      }

      console.log('✅ Bucket created');
    } else {
      console.log('✅ Bucket already exists');
    }

    // Upload to dev storage
    console.log('\n📤 Uploading logo to development storage...');
    const { data: uploadData, error: uploadError } = await devSupabase
      .storage
      .from(BUCKET_NAME)
      .upload(FILE_NAME, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return;
    }

    console.log('✅ Logo uploaded successfully!');
    console.log(`   Path: ${uploadData.path}`);

    // Get public URL
    const { data: publicUrlData } = devSupabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(FILE_NAME);

    console.log(`   Public URL: ${publicUrlData.publicUrl}`);

    console.log('\n✨ Success! The logo should now be available in your development environment.');
    console.log('\n⚠️  Note: The hardcoded URLs in your code still point to production.');
    console.log('   You should update them to use environment-aware URLs.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

downloadAndUploadLogo().catch(console.error);
