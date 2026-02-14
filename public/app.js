/**
 * @file 休暇申請システムのフロントエンドロジック
 * @description Firebase Authenticationを利用したパスワードレス認証と、Firestoreを利用したユーザーの役割に基づくアクセスコントロールを実装する。
 */

document.addEventListener('DOMContentLoaded', function() {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM要素の取得
    const loginForm = document.getElementById('login-form');
    // ★★★ 修正: ログイン後に表示するメインコンテンツのコンテナを取得
    const loggedInContent = document.getElementById('logged-in-content');
    const emailInput = document.getElementById('email-input');
    const sendLinkButton = document.getElementById('send-link-button');
    const logoutButton = document.getElementById('logout-button');
    const userEmailSpan = document.getElementById('user-email');
    const messageP = document.getElementById('message');

    /**
     * @function updateUI
     * @description ユーザーの認証状態に応じてUIを更新し、役割チェックを実行する。
     * @param {firebase.User | null} user - Firebaseのユーザーオブジェクト
     */
    const updateUI = (user) => {
        if (user) {
            // ★★★ 修正: ログインフォームを隠し、メインコンテンツを表示
            loginForm.style.display = 'none';
            loggedInContent.style.display = 'block';
            userEmailSpan.textContent = user.email;
            checkUserRole(user);
        } else {
            // ★★★ 修正: ログインフォームを表示し、メインコンテンツを隠す
            loginForm.style.display = 'block';
            loggedInContent.style.display = 'none';
            userEmailSpan.textContent = '';
            sendLinkButton.disabled = false;
        }
    };

    auth.onAuthStateChanged((user) => {
        updateUI(user);
        if (user) {
            // ログイン成功後、URLからクエリパラメータを削除する
            const newUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        } else {
             // ログアウト時にメッセージをクリア
            messageP.textContent = '';
        }
    });

    /**
     * @function sendSignInLink
     * @description 入力されたメールアドレスに認証リンクを送信する。
     */
    const sendSignInLink = () => {
        const email = emailInput.value;
        if (!email) {
            messageP.textContent = 'メールアドレスを入力してください。';
            return;
        }

        const actionCodeSettings = {
            url: window.location.href,
            handleCodeInApp: true,
        };

        auth.sendSignInLinkToEmail(email, actionCodeSettings)
            .then(() => {
                window.localStorage.setItem('emailForSignIn', email);
                messageP.textContent = `${email} に認証リンクを送信しました。メールを確認してください。`;
                sendLinkButton.disabled = true;
            })
            .catch((error) => {
                console.error(error);
                messageP.textContent = `エラーが発生しました: ${error.message}`;
            });
    };

    /**
     * @function handleSignIn
     * @description URLに含まれる認証リンクを処理し、サインインを完了させる。
     */
    const handleSignIn = () => {
        if (auth.isSignInWithEmailLink(window.location.href)) {
            let email = window.localStorage.getItem('emailForSignIn');
            
            if (!email) {
                console.error('Email for sign in not found in localStorage.');
                messageP.textContent = "認証の有効期限が切れているか、リンクが無効です。お手数ですが、もう一度メールアドレスを入力して認証をやり直してください。";
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                return; 
            }

            auth.signInWithEmailLink(email, window.location.href)
                .then(() => {
                    window.localStorage.removeItem('emailForSignIn');
                })
                .catch((error) => {
                    console.error("Sign-in failed:", error);
                    messageP.textContent = `ログインエラー: ${error.message} (ページをリロードしてもう一度お試しください)`;
                    auth.signOut();
                });
        }
    };

    /**
     * @function handleLogout
     * @description ユーザーをログアウトさせる。
     */
    const handleLogout = () => {
        auth.signOut();
    };

    /**
     * @function checkUserRole
     * @description Firestoreからユーザー情報を取得する。未登録の場合は新規に作成する。
     * @param {firebase.User} user - Firebaseのユーザーオブジェクト
     */
    const checkUserRole = (user) => {
        const userRef = db.collection('users').doc(user.uid);

        userRef.get().then((doc) => {
            if (doc.exists) {
                console.log("登録済みユーザーです。役割:", doc.data().roles);
                messageP.textContent = 'ログインしました。';

            } else {
                console.log("新規ユーザーです。データベースに登録します。");
                messageP.textContent = 'ようこそ！新しいユーザーとしてシステムに登録します...';

                const newUser = {
                    name: user.email.split('@')[0], 
                    email: user.email,
                    roles: ['user'], 
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(), 
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                userRef.set(newUser)
                    .then(() => {
                        console.log("新規ユーザー登録成功:", newUser);
                        messageP.textContent = 'ユーザー登録が完了しました。休暇申請システムへようこそ！';
                    })
                    .catch((error) => {
                        console.error("新規ユーザー登録エラー:", error);
                        messageP.textContent = `ユーザー登録中にエラーが発生しました: ${error.message}`;
                        handleLogout();
                    });
            }
        }).catch((error) => {
            console.error("ユーザー情報の取得エラー:", error);
            messageP.textContent = `ユーザー情報の取得中にエラーが発生しました: ${error.message}`;
            handleLogout();
        });
    };

    // イベントリスナーの設定
    sendLinkButton.addEventListener('click', sendSignInLink);
    logoutButton.addEventListener('click', handleLogout);

    // ページの読み込み時に認証リンクを処理
    handleSignIn();
});
