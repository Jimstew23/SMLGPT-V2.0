import os
import sys
import time
import json
import asyncio
import aiohttp
import requests
from pathlib import Path
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
API_BASE_URL = os.getenv('API_URL', 'http://localhost:5000')
TEST_FILES_DIR = Path('./test-files')

# Test cases
TEST_CASES = [
    {
        'name': 'safety-image-test',
        'file': 'workplace-safety-scene.jpg',
        'type': 'image',
        'description': 'Testing image analysis for workplace safety hazards'
    },
    {
        'name': 'document-test', 
        'file': 'safety-procedures.pdf',
        'type': 'document',
        'description': 'Testing document analysis for safety procedures'
    },
    {
        'name': 'hazard-image-test',
        'file': 'construction-site.png', 
        'type': 'image',
        'description': 'Testing construction site hazard detection'
    }
]


class SMGPTTestClient:
    """Test client for SMLGPT V2.0 API"""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        
    def upload_file(self, file_path: Path, analysis_type: str = 'safety') -> Dict:
        """Upload a file and get analysis results"""
        print(f"\n📤 Uploading file: {file_path.name}")
        
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, self._get_mime_type(file_path))}
            data = {'analysis_type': analysis_type}
            
            start_time = time.time()
            try:
                response = self.session.post(
                    f"{self.base_url}/api/upload",
                    files=files,
                    data=data,
                    timeout=120
                )
                response.raise_for_status()
                
                duration = time.time() - start_time
                print(f"✅ Upload completed in {duration:.2f}s")
                
                return response.json()
                
            except requests.exceptions.RequestException as e:
                print(f"❌ Upload failed: {e}")
                if hasattr(e, 'response') and e.response is not None:
                    print(f"Response: {e.response.text}")
                raise
    
    def send_chat_message(self, message: str, document_ids: List[str] = None) -> Dict:
        """Send a chat message with optional document references"""
        print(f"\n💬 Sending chat message with {len(document_ids or [])} document references")
        
        payload = {
            'message': message,
            'conversation_history': [],
            'include_context': True,
            'document_references': document_ids or [],
            'max_tokens': 2000
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Chat request failed: {e}")
            raise
    
    def check_health(self) -> bool:
        """Check API health status"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=5)
            response.raise_for_status()
            data = response.json()
            return data.get('status') == 'healthy'
        except:
            return False
    
    @staticmethod
    def _get_mime_type(file_path: Path) -> str:
        """Get MIME type based on file extension"""
        ext = file_path.suffix.lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
        return mime_types.get(ext, 'application/octet-stream')


async def async_upload_test(client: SMGPTTestClient, files: List[Path]) -> List[Dict]:
    """Async upload test using aiohttp"""
    print(f"\n⚡ Async upload test with {len(files)} files")
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        for file_path in files:
            task = async_upload_file(session, file_path)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = [r for r in results if not isinstance(r, Exception)]
        print(f"\n✅ Async uploads completed: {len(successful)}/{len(files)} successful")
        
        return successful


async def async_upload_file(session: aiohttp.ClientSession, file_path: Path) -> Dict:
    """Async file upload"""
    url = f"{API_BASE_URL}/api/upload"
    
    data = aiohttp.FormData()
    data.add_field('file',
                   open(file_path, 'rb'),
                   filename=file_path.name,
                   content_type=SMGPTTestClient._get_mime_type(file_path))
    data.add_field('analysis_type', 'safety')
    
    async with session.post(url, data=data) as response:
        return await response.json()


def test_complete_flow(client: SMGPTTestClient) -> List[Dict]:
    """Test the complete upload and chat flow"""
    print('🚀 Starting SMLGPT V2.0 File Upload Test\n')
    print('=' * 50)
    
    uploaded_files = []
    
    # Test 1: Upload and analyze individual files
    for test_case in TEST_CASES:
        print(f"\n\n📋 Test Case: {test_case['name']}")
        print(f"Description: {test_case['description']}")
        print('-' * 50)
        
        file_path = TEST_FILES_DIR / test_case['file']
        
        if not file_path.exists():
            print(f"⚠️  Skipping - File not found: {file_path}")
            continue
        
        try:
            # Upload file
            result = client.upload_file(file_path)
            uploaded_files.append(result)
            
            # Display results
            print('\n📊 Analysis Results:')
            print(f"File ID: {result['file_id']}")
            print(f"Blob URL: {result['blob_url']}")
            print(f"Processing Time: {result['processing_time_ms']}ms")
            print(f"Indexed: {result['indexed']}")
            
            if 'analysis' in result:
                analysis = result['analysis']
                
                if test_case['type'] == 'image' and 'vision_analysis' in analysis:
                    vision = analysis['vision_analysis']
                    print('\n🖼️  Vision Analysis:')
                    print(f"Caption: {vision.get('caption', 'N/A')}")
                    print(f"Tags: {', '.join(vision.get('tags', []))}")
                    print(f"Objects: {', '.join(vision.get('objects', []))}")
                
                if 'safety_analysis' in analysis:
                    safety = analysis['safety_analysis']
                    if isinstance(safety, str):
                        preview = safety[:500]
                    else:
                        preview = json.dumps(safety)[:500]
                    print('\n🦺 Safety Analysis Preview:')
                    print(preview + '...')
                    
        except Exception as e:
            print(f"Failed to process {test_case['file']}: {e}")
    
    # Test 2: Chat with document references
    if uploaded_files:
        print('\n\n🤖 Testing Chat with Document References')
        print('=' * 50)
        
        document_ids = [f['file_id'] for f in uploaded_files]
        
        try:
            chat_response = client.send_chat_message(
                "Analyze the safety hazards in the uploaded images and documents. What are the most critical risks?",
                document_ids
            )
            
            print('\n💬 Chat Response:')
            print(chat_response['response'][:1000] + '...')
            print(f"\nProcessing Time: {chat_response.get('processing_time_ms', 'N/A')}ms")
            print(f"Context Used: {chat_response.get('context_used', 'N/A')}")
            
        except Exception as e:
            print(f'Chat test failed: {e}')
    
    # Summary
    print('\n\n📈 Test Summary')
    print('=' * 50)
    print(f"Total files uploaded: {len(uploaded_files)}")
    print(f"Successful uploads: {len([f for f in uploaded_files if f.get('status') == 'success'])}")
    
    return uploaded_files


def load_test(client: SMGPTTestClient, concurrent: int = 3, total: int = 10):
    """Performance load test"""
    print(f"\n\n⚡ Load Test: {total} uploads with {concurrent} concurrent")
    print('=' * 50)
    
    test_file = TEST_FILES_DIR / 'test-image.jpg'
    if not test_file.exists():
        print('❌ Load test file not found')
        return
    
    start_time = time.time()
    results = []
    
    with ThreadPoolExecutor(max_workers=concurrent) as executor:
        futures = []
        
        for i in range(total):
            future = executor.submit(client.upload_file, test_file)
            futures.append(future)
        
        for i, future in enumerate(as_completed(futures)):
            try:
                result = future.result()
                results.append({
                    'success': True,
                    'time': result['processing_time_ms']
                })
                print(f"✓ Upload {i+1}/{total} completed")
            except Exception as e:
                results.append({
                    'success': False,
                    'error': str(e)
                })
                print(f"✗ Upload {i+1}/{total} failed: {e}")
    
    total_time = time.time() - start_time
    successful = [r for r in results if r['success']]
    avg_time = sum(r['time'] for r in successful) / len(successful) if successful else 0
    
    print('\n📊 Load Test Results:')
    print(f"Total Time: {total_time:.2f}s")
    print(f"Successful: {len(successful)}/{total}")
    print(f"Average Processing Time: {avg_time:.0f}ms")
    print(f"Throughput: {total / total_time:.2f} uploads/second")


def create_test_files():
    """Create sample test files if they don't exist"""
    TEST_FILES_DIR.mkdir(exist_ok=True)
    
    # Create a sample text file
    sample_text = TEST_FILES_DIR / 'sample-safety-doc.txt'
    if not sample_text.exists():
        sample_text.write_text("""
        Safety Procedures Document
        
        1. Always wear appropriate PPE
        2. Check equipment before use
        3. Report hazards immediately
        4. Follow lockout/tagout procedures
        5. Maintain clean work areas
        """)
        print(f"Created sample file: {sample_text}")
    
    print(f"\n📁 Test files directory: {TEST_FILES_DIR.absolute()}")
    print("Please add the following test files:")
    for tc in TEST_CASES:
        print(f"   - {tc['file']}: {tc['description']}")


def main():
    """Main test runner"""
    print('🏁 SMLGPT V2.0 API Test Suite\n')
    
    # Create test client
    client = SMGPTTestClient()
    
    # Check/create test files directory
    if not TEST_FILES_DIR.exists():
        create_test_files()
        return
    
    # Check API health
    print('🏥 Checking API health...')
    if client.check_health():
        print('✅ API is healthy\n')
    else:
        print('❌ API is not responding')
        return
    
    # Parse command line arguments
    test_type = sys.argv[1] if len(sys.argv) > 1 else 'all'
    
    try:
        if test_type == 'upload':
            test_complete_flow(client)
        
        elif test_type == 'async':
            # Test async uploads
            test_files = list(TEST_FILES_DIR.glob('*.jpg'))[:5]
            if test_files:
                asyncio.run(async_upload_test(client, test_files))
            else:
                print('No image files found for async test')
        
        elif test_type == 'load':
            concurrent = int(sys.argv[2]) if len(sys.argv) > 2 else 3
            total = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            load_test(client, concurrent, total)
        
        elif test_type == 'all':
            test_complete_flow(client)
            load_test(client, 3, 10)
        
        else:
            print(f"Unknown test type: {test_type}")
            print("Usage: python test_smlgpt.py [upload|async|load|all] [concurrent] [total]")
    
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        sys.exit(1)
    
    print('\n✅ Test suite completed')


if __name__ == '__main__':
    main()
